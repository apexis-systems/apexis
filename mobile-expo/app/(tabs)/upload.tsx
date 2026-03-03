import { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { launchImageLibrary, launchCamera, type Asset } from 'react-native-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { uploadFileWithProgress } from '@/services/fileService';
import { getProjects } from '@/services/projectService';
import { getFolders } from '@/services/folderService';

type Step = 'project' | 'type' | 'folder' | 'upload' | 'uploading' | 'done';

interface FileProgress {
    asset: Asset;
    progress: number; // 0–100
    status: 'pending' | 'uploading' | 'done' | 'error';
    anim: Animated.Value;
}

export default function UploadScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const { colors } = useTheme();
    const params = useLocalSearchParams<{
        projectId?: string;
        type?: 'documents' | 'photos';
        folderId?: string;
    }>();

    const [step, setStep] = useState<Step>('project');
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [uploadType, setUploadType] = useState<'documents' | 'photos' | null>(null);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [photoLocation, setPhotoLocation] = useState('');
    const [photoTags, setPhotoTags] = useState('');
    const [projects, setProjects] = useState<any[]>([]);
    const [folders, setFolders] = useState<any[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [loadingFolders, setLoadingFolders] = useState(false);
    const [fileQueue, setFileQueue] = useState<FileProgress[]>([]);

    useEffect(() => {
        if (params.projectId && params.type && params.folderId !== undefined) {
            setSelectedProject(params.projectId);
            setUploadType(params.type);
            setSelectedFolder(params.folderId || null);
            setStep('upload');
        } else if (params.projectId && params.type) {
            setSelectedProject(params.projectId);
            setUploadType(params.type);
            setStep('folder');
        } else if (params.projectId) {
            setSelectedProject(params.projectId);
            setStep('type');
        }
    }, [params]);

    useEffect(() => {
        if (!user) return;
        setLoadingProjects(true);
        getProjects()
            .then((data) => { if (data.projects) setProjects(data.projects); })
            .catch((e) => console.error('fetchProjects', e))
            .finally(() => setLoadingProjects(false));
    }, [user]);

    useEffect(() => {
        if (!selectedProject || !uploadType) { setFolders([]); return; }
        setLoadingFolders(true);
        getFolders(selectedProject, uploadType)
            .then((data) => { if (data.folders) setFolders(data.folders); })
            .catch((e) => console.error('fetchFolders', e))
            .finally(() => setLoadingFolders(false));
    }, [selectedProject, uploadType]);

    if (!user || user.role === 'client') {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>Upload is not available for your role.</Text>
            </SafeAreaView>
        );
    }

    const selectedProjectData = projects.find((p) => p.id === selectedProject);
    const selectedFolderData = folders.find((f) => f.id === selectedFolder);

    // ── Pickers ───────────────────────────────────────────────────────────────

    const pickFromGallery = () => {
        launchImageLibrary(
            { mediaType: 'photo', selectionLimit: 0, quality: 0.8 },
            (response: any) => {
                if (response.didCancel || response.errorCode) return;
                const assets = response.assets || [];
                if (assets.length === 0) return;
                const queue: FileProgress[] = assets.map((a: any) => ({
                    asset: a,
                    progress: 0,
                    status: 'pending',
                    anim: new Animated.Value(0),
                }));
                setFileQueue(queue);
            }
        );
    };

    const pickFromCamera = () => {
        launchCamera(
            { mediaType: 'photo', quality: 0.8 },
            (response: any) => {
                if (response.didCancel || response.errorCode) return;
                const assets = response.assets || [];
                if (assets.length === 0) return;
                const queue: FileProgress[] = assets.map((a: any) => ({
                    asset: a,
                    progress: 0,
                    status: 'pending',
                    anim: new Animated.Value(0),
                }));
                setFileQueue(queue);
            }
        );
    };

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-powerpoint',
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    'application/acad', 'image/vnd.dwg', 'application/dxf',
                    'text/plain', '*/*'],
                multiple: true,
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.length) return;
            const queue: FileProgress[] = result.assets.map((a) => ({
                asset: { uri: a.uri, fileName: a.name, type: a.mimeType, size: a.size } as Asset,
                progress: 0,
                status: 'pending',
                anim: new Animated.Value(0),
            }));
            setFileQueue(queue);
        } catch (err) {
            console.error('pickDocument error:', err);
        }
    };

    // ── Upload ────────────────────────────────────────────────────────────────

    const handleUpload = async () => {
        if (fileQueue.length === 0) {
            Alert.alert('No files', 'Please select at least one file.');
            return;
        }
        if (!selectedProject || selectedFolder === undefined) {
            Alert.alert('Error', 'Project and folder must be selected.');
            return;
        }

        setStep('uploading');

        const updatedQueue = [...fileQueue];

        for (let i = 0; i < updatedQueue.length; i++) {
            const item = updatedQueue[i];
            updatedQueue[i] = { ...item, status: 'uploading' };
            setFileQueue([...updatedQueue]);

            try {
                const formData = new FormData();
                formData.append('file', {
                    uri: item.asset.uri,
                    name: item.asset.fileName || `upload_${i}.jpg`,
                    type: item.asset.type || 'image/jpeg',
                } as any);
                formData.append('project_id', selectedProject);
                if (selectedFolder) formData.append('folder_id', selectedFolder);
                if (uploadType === 'photos') {
                    if (photoLocation) formData.append('location', photoLocation);
                    if (photoTags) formData.append('tags', photoTags);
                }

                await uploadFileWithProgress(formData, (pct) => {
                    updatedQueue[i] = { ...updatedQueue[i], progress: pct };
                    setFileQueue([...updatedQueue]);
                    Animated.timing(updatedQueue[i].anim, {
                        toValue: pct / 100,
                        duration: 100,
                        useNativeDriver: false,
                    }).start();
                });

                updatedQueue[i] = { ...updatedQueue[i], progress: 100, status: 'done' };
                setFileQueue([...updatedQueue]);
            } catch (err) {
                updatedQueue[i] = { ...updatedQueue[i], status: 'error' };
                setFileQueue([...updatedQueue]);
                console.error(`Upload error for file ${i}:`, err);
            }
        }

        setStep('done');
    };

    const goBack = () => {
        if (step === 'project') router.push('/(tabs)');
        else if (step === 'type') setStep('project');
        else if (step === 'folder') setStep('type');
        else if (step === 'upload') setStep('folder');
        else if (step === 'uploading') return; // block nav during upload
        else router.push('/(tabs)');
    };

    const reset = () => {
        setStep('project');
        setSelectedProject(null);
        setUploadType(null);
        setSelectedFolder(null);
        setPhotoLocation('');
        setPhotoTags('');
        setFileQueue([]);
    };

    const doneCount = fileQueue.filter((f) => f.status === 'done').length;
    const errorCount = fileQueue.filter((f) => f.status === 'error').length;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>

                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <TouchableOpacity onPress={goBack} style={{ padding: 6, borderRadius: 20 }}>
                        <Feather name="arrow-left" size={18} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Upload Files</Text>
                </View>

                {/* Breadcrumb */}
                {selectedProject && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
                        <Text style={{ fontSize: 10, color: colors.textMuted }}>{selectedProjectData?.name}</Text>
                        {uploadType && (
                            <>
                                <Text style={{ fontSize: 10, color: colors.textMuted }}>›</Text>
                                <Text style={{ fontSize: 10, color: colors.textMuted, textTransform: 'capitalize' }}>{uploadType}</Text>
                            </>
                        )}
                        {selectedFolder && (
                            <>
                                <Text style={{ fontSize: 10, color: colors.textMuted }}>›</Text>
                                <Text style={{ fontSize: 10, color: colors.textMuted }}>{selectedFolderData?.name}</Text>
                            </>
                        )}
                    </View>
                )}

                {/* ── Step: Project ── */}
                {step === 'project' && (
                    <View>
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 12 }}>Select a project</Text>
                        {loadingProjects ? (
                            <Text style={{ fontSize: 11, color: colors.textMuted }}>Loading projects…</Text>
                        ) : (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                {projects.map((project) => (
                                    <TouchableOpacity
                                        key={project.id}
                                        onPress={() => { setSelectedProject(project.id); setStep('type'); }}
                                        style={{ width: '22%', alignItems: 'center', gap: 4 }}
                                    >
                                        <View style={{
                                            width: 56, height: 56, borderRadius: 14,
                                            backgroundColor: project.color || colors.primary,
                                            alignItems: 'center', justifyContent: 'center',
                                            borderWidth: 1, borderColor: colors.border,
                                        }}>
                                            <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff' }}>
                                                {project.name.charAt(0)}
                                            </Text>
                                        </View>
                                        <Text numberOfLines={2} style={{ fontSize: 10, fontWeight: '500', color: colors.text, textAlign: 'center' }}>
                                            {project.name.split(' ').slice(0, 2).join(' ')}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {/* ── Step: Type ── */}
                {step === 'type' && (
                    <View style={{ gap: 8 }}>
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>What are you uploading?</Text>
                        {(['documents', 'photos'] as const).map((t) => (
                            <TouchableOpacity
                                key={t}
                                onPress={() => { setUploadType(t); setStep('folder'); }}
                                style={{
                                    flexDirection: 'row', alignItems: 'center', gap: 12,
                                    borderRadius: 10, backgroundColor: colors.surface,
                                    borderWidth: 1, borderColor: colors.border, padding: 14,
                                }}
                            >
                                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                                    <Feather name={t === 'documents' ? 'file-text' : 'camera'} size={20} color={colors.text} />
                                </View>
                                <View>
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, textTransform: 'capitalize' }}>{t}</Text>
                                    <Text style={{ fontSize: 10, color: colors.textMuted }}>
                                        {t === 'documents' ? 'PDFs, DWG files, drawings' : 'Site photos with metadata'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* ── Step: Folder ── */}
                {step === 'folder' && (
                    <View>
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 12 }}>Select a folder</Text>
                        {loadingFolders ? (
                            <Text style={{ fontSize: 11, color: colors.textMuted }}>Loading folders…</Text>
                        ) : folders.length === 0 ? (
                            <View style={{ marginTop: 30, alignItems: 'center' }}>
                                <Feather name="folder" size={32} color={colors.border} />
                                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>No folders available</Text>
                            </View>
                        ) : (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                <TouchableOpacity
                                    onPress={() => { setSelectedFolder(null); setStep('upload'); }}
                                    style={{
                                        width: '30%', alignItems: 'center', gap: 4,
                                        borderRadius: 10, backgroundColor: colors.surface,
                                        borderWidth: 1, borderColor: colors.border, padding: 12,
                                    }}
                                >
                                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(249,115,22,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                        <Feather name="folder" size={16} color={colors.primary} />
                                    </View>
                                    <Text numberOfLines={2} style={{ fontSize: 10, fontWeight: '700', color: colors.text, textAlign: 'center' }}>
                                        Root Level
                                    </Text>
                                </TouchableOpacity>
                                {folders.map((folder) => (
                                    <TouchableOpacity
                                        key={folder.id}
                                        onPress={() => { setSelectedFolder(folder.id); setStep('upload'); }}
                                        style={{
                                            width: '30%', alignItems: 'center', gap: 4,
                                            borderRadius: 10, backgroundColor: colors.surface,
                                            borderWidth: 1, borderColor: colors.border, padding: 12,
                                        }}
                                    >
                                        <Feather name="folder" size={32} color={colors.primary} />
                                        <Text numberOfLines={2} style={{ fontSize: 10, fontWeight: '500', color: colors.text, textAlign: 'center' }}>
                                            {folder.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {/* ── Step: Upload (select files) ── */}
                {step === 'upload' && (
                    <View style={{ gap: 14 }}>
                        {/* Pickers */}
                        {uploadType === 'photos' ? (
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity
                                    onPress={pickFromCamera}
                                    style={{
                                        flex: 1, borderRadius: 10, borderWidth: 2,
                                        borderColor: colors.border, borderStyle: 'dashed',
                                        backgroundColor: colors.surface, padding: 20, alignItems: 'center',
                                    }}
                                >
                                    <Feather name="camera" size={26} color={colors.textMuted} />
                                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text, marginTop: 6 }}>Camera</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={pickFromGallery}
                                    style={{
                                        flex: 1, borderRadius: 10, borderWidth: 2,
                                        borderColor: fileQueue.length > 0 ? colors.primary : colors.border,
                                        borderStyle: 'dashed', backgroundColor: colors.surface,
                                        padding: 20, alignItems: 'center',
                                    }}
                                >
                                    <Feather name="image" size={26} color={fileQueue.length > 0 ? colors.primary : colors.textMuted} />
                                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text, marginTop: 6 }}>Gallery</Text>
                                    {fileQueue.length > 0 && (
                                        <View style={{
                                            marginTop: 4, backgroundColor: colors.primary,
                                            borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
                                        }}>
                                            <Text style={{ fontSize: 9, color: '#fff', fontWeight: '700' }}>
                                                {fileQueue.length} selected
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={pickDocument}
                                style={{
                                    borderRadius: 10, borderWidth: 2,
                                    borderColor: fileQueue.length > 0 ? colors.primary : colors.border,
                                    borderStyle: 'dashed', backgroundColor: colors.surface,
                                    padding: 30, alignItems: 'center',
                                }}
                            >
                                <Feather name="upload-cloud" size={32} color={fileQueue.length > 0 ? colors.primary : colors.textMuted} />
                                <Text style={{ fontSize: 12, fontWeight: '500', color: colors.text, marginTop: 8 }}>
                                    {fileQueue.length > 0 ? `${fileQueue.length} file(s) selected` : 'Tap to select files'}
                                </Text>
                                {fileQueue.length === 0 && (
                                    <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>
                                        PDF, DWG, Image files supported
                                    </Text>
                                )}
                            </TouchableOpacity>
                        )}

                        {/* Selected file list preview */}
                        {fileQueue.length > 0 && (
                            <View style={{ gap: 6 }}>
                                {fileQueue.map((item, idx) => (
                                    <View key={idx} style={{
                                        flexDirection: 'row', alignItems: 'center', gap: 8,
                                        backgroundColor: colors.surface, borderRadius: 8,
                                        borderWidth: 1, borderColor: colors.border, padding: 10,
                                    }}>
                                        <Feather name={uploadType === 'photos' ? 'image' : 'file'} size={14} color={colors.primary} />
                                        <Text numberOfLines={1} style={{ flex: 1, fontSize: 11, color: colors.text }}>
                                            {item.asset.fileName || `file_${idx + 1}`}
                                        </Text>
                                        <TouchableOpacity onPress={() => setFileQueue(fileQueue.filter((_, i) => i !== idx))}>
                                            <Feather name="x" size={14} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Photo metadata */}
                        {uploadType === 'photos' && fileQueue.length > 0 && (
                            <>
                                <View>
                                    <Text style={{ fontSize: 10, fontWeight: '500', color: colors.text, marginBottom: 6 }}>Location</Text>
                                    <TextInput
                                        value={photoLocation}
                                        onChangeText={setPhotoLocation}
                                        placeholder="e.g., Block A - Ground Floor"
                                        placeholderTextColor={colors.textMuted}
                                        style={{
                                            height: 38, borderRadius: 10, backgroundColor: colors.surface,
                                            borderWidth: 1, borderColor: colors.border, color: colors.text,
                                            paddingHorizontal: 12, fontSize: 12,
                                        }}
                                    />
                                </View>
                                <View>
                                    <Text style={{ fontSize: 10, fontWeight: '500', color: colors.text, marginBottom: 6 }}>Tags</Text>
                                    <TextInput
                                        value={photoTags}
                                        onChangeText={setPhotoTags}
                                        placeholder="e.g., foundation, concrete"
                                        placeholderTextColor={colors.textMuted}
                                        style={{
                                            height: 38, borderRadius: 10, backgroundColor: colors.surface,
                                            borderWidth: 1, borderColor: colors.border, color: colors.text,
                                            paddingHorizontal: 12, fontSize: 12,
                                        }}
                                    />
                                </View>
                            </>
                        )}

                        {/* Upload button */}
                        <TouchableOpacity
                            onPress={handleUpload}
                            disabled={fileQueue.length === 0}
                            style={{
                                height: 44, borderRadius: 10,
                                backgroundColor: fileQueue.length === 0 ? colors.border : '#f97316',
                                alignItems: 'center', justifyContent: 'center', marginTop: 4,
                            }}
                        >
                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>
                                Upload {fileQueue.length > 0 ? `${fileQueue.length} file${fileQueue.length > 1 ? 's' : ''}` : 'Files'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── Step: Uploading (progress view) ── */}
                {step === 'uploading' && (
                    <View style={{ gap: 12 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
                            Uploading {doneCount}/{fileQueue.length}…
                        </Text>
                        {fileQueue.map((item, idx) => (
                            <View key={idx} style={{
                                backgroundColor: colors.surface, borderRadius: 10,
                                borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8,
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Feather
                                        name={item.status === 'done' ? 'check-circle' : item.status === 'error' ? 'x-circle' : 'upload-cloud'}
                                        size={14}
                                        color={item.status === 'done' ? '#22c55e' : item.status === 'error' ? '#ef4444' : colors.primary}
                                    />
                                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 11, color: colors.text }}>
                                        {item.asset.fileName || `file_${idx + 1}`}
                                    </Text>
                                    <Text style={{ fontSize: 10, color: item.status === 'error' ? '#ef4444' : colors.primary, fontWeight: '600' }}>
                                        {item.status === 'error' ? 'Failed' : item.status === 'done' ? '100%' : `${item.progress}%`}
                                    </Text>
                                </View>
                                {/* Progress bar */}
                                <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' }}>
                                    <Animated.View
                                        style={{
                                            height: 4,
                                            borderRadius: 2,
                                            backgroundColor: item.status === 'error' ? '#ef4444' : item.status === 'done' ? '#22c55e' : '#f97316',
                                            width: `${item.status === 'done' ? 100 : item.progress}%`,
                                        }}
                                    />
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* ── Step: Done ── */}
                {step === 'done' && (
                    <View style={{ alignItems: 'center', paddingTop: 40 }}>
                        <View style={{
                            width: 64, height: 64, borderRadius: 32,
                            backgroundColor: 'rgba(249,115,22,0.12)',
                            alignItems: 'center', justifyContent: 'center', marginBottom: 14,
                        }}>
                            <Feather name="check" size={30} color="#f97316" />
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
                            {errorCount === 0 ? 'Upload Complete!' : 'Upload Finished'}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4, textAlign: 'center' }}>
                            {doneCount} file{doneCount !== 1 ? 's' : ''} uploaded successfully
                        </Text>
                        {errorCount > 0 && (
                            <Text style={{ fontSize: 11, color: '#ef4444', marginBottom: 8, textAlign: 'center' }}>
                                {errorCount} file{errorCount !== 1 ? 's' : ''} failed
                            </Text>
                        )}
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                            <TouchableOpacity
                                onPress={reset}
                                style={{
                                    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
                                    paddingHorizontal: 20, paddingVertical: 10,
                                }}
                            >
                                <Text style={{ fontSize: 12, color: colors.text, fontWeight: '600' }}>Upload More</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => { reset(); router.push('/(tabs)'); }}
                                style={{
                                    borderRadius: 10, backgroundColor: '#f97316',
                                    paddingHorizontal: 20, paddingVertical: 10,
                                }}
                            >
                                <Text style={{ fontSize: 12, color: '#fff', fontWeight: '600' }}>Back to Dashboard</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
}
