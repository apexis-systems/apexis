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
import { mockProjects, mockFolders } from '@/data/mock';
import { useTheme } from '@/contexts/ThemeContext';

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

    if (!user || user.role === 'client') {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>Upload is not available for your role.</Text>
            </SafeAreaView>
        );
    }

    const projects = mockProjects.filter((p) => {
        if (user.role === 'admin') return true;
        return p.assignedTo.includes(user.id);
    });

    const folders =
        selectedProject && uploadType
            ? mockFolders.filter((f) => f.projectId === selectedProject && f.type === uploadType)
            : [];

    const selectedProjectData = mockProjects.find((p) => p.id === selectedProject);
    const selectedFolderData = mockFolders.find((f) => f.id === selectedFolder);

    const handleUpload = () => {
        setStep('done');
        Alert.alert('Success', 'Files uploaded successfully!');
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
                            {projects.map((project) => (
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
                                            backgroundColor: project.color,
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
                        <TouchableOpacity
                            style={{
                                borderRadius: 10,
                                borderWidth: 2,
                                borderColor: colors.border,
                                borderStyle: 'dashed',
                                backgroundColor: colors.surface,
                                padding: 30,
                                alignItems: 'center',
                            }}
                        >
                            <Feather name="upload-cloud" size={32} color={colors.textMuted} />
                            <Text style={{ fontSize: 12, fontWeight: '500', color: colors.text, marginTop: 8 }}>
                                Tap to select {uploadType === 'documents' ? 'documents' : 'photos'}
                            </Text>
                            <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>
                                {uploadType === 'documents' ? 'PDF, DWG files supported' : 'JPG, PNG files supported'}
                            </Text>
                        </TouchableOpacity>

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
                            style={{
                                height: 42,
                                borderRadius: 10,
                                backgroundColor: '#f97316',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Upload Files</Text>
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
