import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Image, Modal, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getProjects } from '@/services/projectService';
import { getProjectFiles } from '@/services/fileService';
import { uploadFile } from '@/services/fileService';

interface SaveScanModalProps {
    imageUri: string;
    onDiscard: () => void;
    onSaveSuccess: () => void;
}

export default function SaveScanModal({ imageUri, onDiscard, onSaveSuccess }: SaveScanModalProps) {
    const { user } = useAuth();
    const { colors } = useTheme();

    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');

    // We only care about Document folders (or whatever folders the user has)
    const [folders, setFolders] = useState<any[]>([]);
    const [selectedFolderId, setSelectedFolderId] = useState<string>('');

    const [loadingData, setLoadingData] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        setLoadingData(true);
        try {
            const res = await getProjects();
            // In a real scenario you might need to filter based on user role
            const projectsArray = res?.projects || [];
            setProjects(projectsArray);
            if (projectsArray.length > 0) {
                // Auto-select first project just for convenience
                handleProjectSelect(projectsArray[0].id.toString());
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingData(false);
        }
    };

    const handleProjectSelect = async (projectId: string) => {
        setSelectedProjectId(projectId);
        setFolders([]);
        setSelectedFolderId('');

        if (!projectId) return;

        setLoadingData(true);
        try {
            const fileData = await getProjectFiles(projectId);
            if (fileData && fileData.folderData) {
                // Filter specifically for "documents" type or keep all. Since scans are usually docs.
                const docsFolders = fileData.folderData.filter((f: any) => f.type === 'documents');
                setFolders(docsFolders);
            }
        } catch (error) {
            console.error("Failed to fetch project folders", error);
        } finally {
            setLoadingData(false);
        }
    };

    const handleUpload = async () => {
        if (!selectedProjectId) {
            Alert.alert("Missing Info", "Please select a project.");
            return;
        }

        setUploading(true);

        // Prep the image for existing upload file function
        // Need to create a react-native style file object
        const uriParts = imageUri.split('.');
        const fileType = uriParts[uriParts.length - 1]; // e.g. jpg

        const timestamp = new Date().getTime();
        const fileName = `Scan_${timestamp}.jpg`;

        const fileToUpload = {
            uri: imageUri,
            name: fileName,
            type: `image/jpeg` // forcing jpeg since camera captures JPEG natively mostly
        };

        try {
            const formData = new FormData();
            formData.append('file', fileToUpload as any);
            formData.append('project_id', selectedProjectId);
            // Scan normally defaults to documents
            formData.append('type', 'documents');
            if (selectedFolderId) {
                formData.append('folder_id', selectedFolderId);
            }

            // Re-using the same service we use in regular uploads
            await uploadFile(formData);

            Alert.alert("Success", "Scan uploaded successfully!");
            onSaveSuccess();
        } catch (error) {
            Alert.alert("Error", "Failed to upload scan.");
            console.error(error);
        } finally {
            setUploading(false);
        }
    };

    return (
        <Modal animationType="slide" transparent={false} visible={true} onRequestClose={onDiscard}>
            <View style={{ flex: 1, backgroundColor: '#000' }}>
                <View style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#333'
                }}>
                    <TouchableOpacity onPress={onDiscard} disabled={uploading}>
                        <Text style={{ color: '#fff', fontSize: 16 }}>Discard</Text>
                    </TouchableOpacity>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Save Scan</Text>
                    <TouchableOpacity onPress={handleUpload} disabled={uploading || !selectedProjectId}>
                        {uploading ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <Text style={{ color: selectedProjectId ? colors.primary : '#666', fontSize: 16, fontWeight: '600' }}>Save</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={{ padding: 20 }}>
                    <Image
                        source={{ uri: imageUri }}
                        style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12, marginBottom: 24, backgroundColor: '#222' }}
                        resizeMode="contain"
                    />

                    <Text style={{ color: '#aaa', fontSize: 13, textTransform: 'uppercase', marginBottom: 8, fontWeight: '600', marginTop: 12 }}>
                        File Destination
                    </Text>

                    <View style={{ backgroundColor: '#222', borderRadius: 12, padding: 16, gap: 16 }}>

                        {/* Project Picker */}
                        <View>
                            <Text style={{ color: '#fff', fontSize: 14, marginBottom: 8 }}>Select Project</Text>
                            <View style={{ backgroundColor: '#333', borderRadius: 8, overflow: 'hidden' }}>
                                <Picker
                                    selectedValue={selectedProjectId}
                                    onValueChange={handleProjectSelect}
                                    style={{ color: '#fff', height: 50 }}
                                    dropdownIconColor="#fff"
                                    enabled={!uploading && !loadingData}
                                >
                                    <Picker.Item label="Choose a project..." value="" />
                                    {projects.map((p) => (
                                        <Picker.Item key={p.id.toString()} label={p.name} value={p.id.toString()} />
                                    ))}
                                </Picker>
                            </View>
                        </View>

                        {/* Folder Picker */}
                        <View>
                            <Text style={{ color: '#fff', fontSize: 14, marginBottom: 8 }}>Select Folder (Optional)</Text>
                            <View style={{ backgroundColor: '#333', borderRadius: 8, overflow: 'hidden' }}>
                                {loadingData ? (
                                    <View style={{ height: 50, justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 16 }}>
                                        <ActivityIndicator size="small" color={colors.primary} />
                                    </View>
                                ) : (
                                    <Picker
                                        selectedValue={selectedFolderId}
                                        onValueChange={(val) => setSelectedFolderId(val)}
                                        style={{ color: '#fff', height: 50 }}
                                        dropdownIconColor="#fff"
                                        enabled={!uploading && !!selectedProjectId}
                                    >
                                        <Picker.Item label="Root (No Folder)" value="" />
                                        {folders.map((f) => (
                                            <Picker.Item key={f.id.toString()} label={f.name} value={f.id.toString()} />
                                        ))}
                                    </Picker>
                                )}
                            </View>
                        </View>

                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}
