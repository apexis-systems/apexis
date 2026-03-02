import { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { uploadFile } from '@/services/fileService';

type Step = 'project' | 'type' | 'folder' | 'upload' | 'done';

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
    const [selectedAsset, setSelectedAsset] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (params.projectId && params.type && params.folderId) {
            setSelectedProject(params.projectId);
            setUploadType(params.type);
            setSelectedFolder(params.folderId);
            setStep('upload');
        } else if (params.projectId && params.type) {
            setSelectedProject(params.projectId);
            setUploadType(params.type);
            setStep('folder');
        } else if (params.projectId) {
            setSelectedProject(params.projectId);
            setStep('type');
        }
    }, []);

    useEffect(() => {
        const fetchProjects = async () => {
            if (!user) return;
            setLoadingProjects(true);
            try {
                const data = await getProjects();
                if (data.projects) {
                    setProjects(data.projects);
                }
            } catch (error) {
                console.error("Failed to fetch projects:", error);
            } finally {
                setLoadingProjects(false);
            }
        };
        fetchProjects();
    }, [user]);

    useEffect(() => {
        const fetchFolders = async () => {
            if (!selectedProject || !uploadType) {
                setFolders([]);
                return;
            }
            setLoadingFolders(true);
            try {
                const data = await getFolders(selectedProject, uploadType);
                if (data.folders) {
                    setFolders(data.folders);
                }
            } catch (error) {
                console.error("Failed to fetch folders:", error);
            } finally {
                setLoadingFolders(false);
            }
        };
        fetchFolders();
    }, [selectedProject, uploadType]);

    if (!user || user.role === 'client') {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>Upload is not available for your role.</Text>
            </SafeAreaView>
        );
    }

    const filteredProjects = projects.filter((p) => {
        if (user.role === 'admin' || user.role === 'superadmin') return true;
        // Depending on backend population for assigned users, filtering might happen there
        return true;
    });

    const selectedProjectData = projects.find((p) => p.id === selectedProject);
    const selectedFolderData = folders.find((f) => f.id === selectedFolder);

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true,
            });
            if (result.canceled === false && result.assets && result.assets.length > 0) {
                setSelectedAsset(result.assets[0]);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const pickImage = async (useCamera: boolean) => {
        try {
            let result;
            if (useCamera) {
                const permission = await ImagePicker.requestCameraPermissionsAsync();
                if (!permission.granted) {
                    Alert.alert('Permission needed', 'Camera access is required.');
                    return;
                }
                result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ['images'],
                    quality: 0.8,
                });
            } else {
                result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    quality: 0.8,
                });
            }

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setSelectedAsset(result.assets[0]);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleUpload = async () => {
        if (!selectedAsset) {
            Alert.alert('Error', 'Please select a file first');
            return;
        }
        if (!selectedProject || !selectedFolder) {
            Alert.alert('Error', 'Project and folder must be selected');
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', {
                uri: selectedAsset.uri,
                name: selectedAsset.name || selectedAsset.fileName || 'upload.jpg',
                type: selectedAsset.mimeType || 'image/jpeg'
            } as any);

            formData.append('project_id', selectedProject);
            formData.append('folder_id', selectedFolder);

            if (uploadType === 'photos') {
                formData.append('location', photoLocation);
                formData.append('tags', photoTags);
            }

            await uploadFile(formData);

            setStep('done');
            setSelectedAsset(null);
        } catch (error) {
            console.error('Upload Error:', error);
            Alert.alert('Upload Failed', 'There was an error uploading your file.');
        } finally {
            setIsUploading(false);
        }
    };

    const goBack = () => {
        if (step === 'project') router.push('/(tabs)');
        else if (step === 'type') setStep('project');
        else if (step === 'folder') setStep('type');
        else if (step === 'upload') setStep('folder');
        else router.push('/(tabs)');
    };

    const reset = () => {
        setStep('project');
        setSelectedProject(null);
        setUploadType(null);
        setSelectedFolder(null);
        setPhotoLocation('');
        setPhotoTags('');
    };

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

                {/* Step: Project */}
                {step === 'project' && (
                    <View>
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 12 }}>Select a project</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                            {filteredProjects.map((project) => (
                                <TouchableOpacity
                                    key={project.id}
                                    onPress={() => { setSelectedProject(project.id); setStep('type'); }}
                                    style={{ width: '22%', alignItems: 'center', gap: 4 }}
                                >
                                    <View
                                        style={{
                                            width: 56,
                                            height: 56,
                                            borderRadius: 14,
                                            backgroundColor: project.color || colors.primary,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                        }}
                                    >
                                        <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff' }}>
                                            {project.name.charAt(0)}
                                        </Text>
                                    </View>
                                    <Text
                                        numberOfLines={2}
                                        style={{ fontSize: 10, fontWeight: '500', color: colors.text, textAlign: 'center' }}
                                    >
                                        {project.name.split(' ').slice(0, 2).join(' ')}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* Step: Type */}
                {step === 'type' && (
                    <View style={{ gap: 8 }}>
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>What are you uploading?</Text>
                        <TouchableOpacity
                            onPress={() => { setUploadType('documents'); setStep('folder'); }}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 12,
                                borderRadius: 10,
                                backgroundColor: colors.surface,
                                borderWidth: 1,
                                borderColor: colors.border,
                                padding: 14,
                            }}
                        >
                            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                                <Feather name="file-text" size={20} color={colors.text} />
                            </View>
                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Documents</Text>
                                <Text style={{ fontSize: 10, color: colors.textMuted }}>PDFs, DWG files, drawings</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => { setUploadType('photos'); setStep('folder'); }}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 12,
                                borderRadius: 10,
                                backgroundColor: colors.surface,
                                borderWidth: 1,
                                borderColor: colors.border,
                                padding: 14,
                            }}
                        >
                            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                                <Feather name="camera" size={20} color={colors.text} />
                            </View>
                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Photos</Text>
                                <Text style={{ fontSize: 10, color: colors.textMuted }}>Site photos with metadata</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Step: Folder */}
                {step === 'folder' && (
                    <View>
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 12 }}>Select a folder</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {folders.map((folder) => (
                                <TouchableOpacity
                                    key={folder.id}
                                    onPress={() => { setSelectedFolder(folder.id); setStep('upload'); }}
                                    style={{
                                        width: '30%',
                                        alignItems: 'center',
                                        gap: 4,
                                        borderRadius: 10,
                                        backgroundColor: colors.surface,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        padding: 12,
                                    }}
                                >
                                    <Feather name="folder" size={32} color={colors.primary} />
                                    <Text numberOfLines={2} style={{ fontSize: 10, fontWeight: '500', color: colors.text, textAlign: 'center' }}>
                                        {folder.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        {folders.length === 0 && (
                            <View style={{ marginTop: 30, alignItems: 'center' }}>
                                <Feather name="folder" size={32} color={colors.border} />
                                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>No folders available</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Step: Upload */}
                {step === 'upload' && (
                    <View style={{ gap: 12 }}>
                        {uploadType === 'documents' ? (
                            <TouchableOpacity
                                onPress={pickDocument}
                                style={{
                                    borderRadius: 10,
                                    borderWidth: 2,
                                    borderColor: selectedAsset ? colors.primary : colors.border,
                                    borderStyle: 'dashed',
                                    backgroundColor: colors.surface,
                                    padding: 30,
                                    alignItems: 'center',
                                }}
                            >
                                <Feather name="upload-cloud" size={32} color={selectedAsset ? colors.primary : colors.textMuted} />
                                <Text style={{ fontSize: 12, fontWeight: '500', color: colors.text, marginTop: 8 }}>
                                    {selectedAsset ? selectedAsset.name : 'Tap to select document'}
                                </Text>
                                {!selectedAsset && (
                                    <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>
                                        PDF, DWG, Image files supported
                                    </Text>
                                )}
                            </TouchableOpacity>
                        ) : (
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <TouchableOpacity
                                    onPress={() => pickImage(true)}
                                    style={{
                                        flex: 1,
                                        borderRadius: 10,
                                        borderWidth: 2,
                                        borderColor: colors.border,
                                        borderStyle: 'dashed',
                                        backgroundColor: colors.surface,
                                        padding: 20,
                                        alignItems: 'center',
                                    }}
                                >
                                    <Feather name="camera" size={28} color={colors.textMuted} />
                                    <Text style={{ fontSize: 12, fontWeight: '500', color: colors.text, marginTop: 8, textAlign: 'center' }}>
                                        Take Photo
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => pickImage(false)}
                                    style={{
                                        flex: 1,
                                        borderRadius: 10,
                                        borderWidth: 2,
                                        borderColor: colors.border,
                                        borderStyle: 'dashed',
                                        backgroundColor: colors.surface,
                                        padding: 20,
                                        alignItems: 'center',
                                    }}
                                >
                                    <Feather name="image" size={28} color={colors.textMuted} />
                                    <Text style={{ fontSize: 12, fontWeight: '500', color: colors.text, marginTop: 8, textAlign: 'center' }}>
                                        Gallery
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {uploadType === 'photos' && selectedAsset && (
                            <View style={{ marginTop: 8, padding: 12, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.primary }}>
                                <Text style={{ fontSize: 12, color: colors.text }} numberOfLines={1}>
                                    Selected: {selectedAsset.fileName || 'Photo'}
                                </Text>
                            </View>
                        )}

                        {uploadType === 'photos' && (
                            <>
                                <View>
                                    <Text style={{ fontSize: 10, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                        Location
                                    </Text>
                                    <TextInput
                                        value={photoLocation}
                                        onChangeText={setPhotoLocation}
                                        placeholder="e.g., Block A - Ground Floor"
                                        placeholderTextColor={colors.textMuted}
                                        style={{
                                            height: 38,
                                            borderRadius: 10,
                                            backgroundColor: colors.surface,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                            color: colors.text,
                                            paddingHorizontal: 12,
                                            fontSize: 12,
                                        }}
                                    />
                                </View>
                                <View>
                                    <Text style={{ fontSize: 10, fontWeight: '500', color: colors.text, marginBottom: 6 }}>
                                        Tags
                                    </Text>
                                    <TextInput
                                        value={photoTags}
                                        onChangeText={setPhotoTags}
                                        placeholder="e.g., foundation, concrete"
                                        placeholderTextColor={colors.textMuted}
                                        style={{
                                            height: 38,
                                            borderRadius: 10,
                                            backgroundColor: colors.surface,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                            color: colors.text,
                                            paddingHorizontal: 12,
                                            fontSize: 12,
                                        }}
                                    />
                                </View>
                            </>
                        )}

                        <TouchableOpacity
                            onPress={handleUpload}
                            disabled={!selectedAsset || isUploading}
                            style={{
                                height: 42,
                                borderRadius: 10,
                                backgroundColor: (!selectedAsset || isUploading) ? colors.border : '#f97316',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginTop: 12
                            }}
                        >
                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>
                                {isUploading ? 'Uploading...' : 'Upload Files'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Step: Done */}
                {step === 'done' && (
                    <View style={{ alignItems: 'center', paddingTop: 40 }}>
                        <View
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 28,
                                backgroundColor: 'rgba(249,115,22,0.15)',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 12,
                            }}
                        >
                            <Feather name="check" size={28} color={colors.primary} />
                        </View>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
                            Upload Complete
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 24, textAlign: 'center' }}>
                            Your files have been uploaded successfully.
                        </Text>
                        <TouchableOpacity
                            onPress={() => { reset(); router.push('/(tabs)'); }}
                            style={{
                                borderRadius: 10,
                                backgroundColor: '#f97316',
                                paddingHorizontal: 24,
                                paddingVertical: 10,
                            }}
                        >
                            <Text style={{ fontSize: 13, color: '#fff', fontWeight: '600' }}>Back to Dashboard</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
