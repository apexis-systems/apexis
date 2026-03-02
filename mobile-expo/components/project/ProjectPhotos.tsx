import { View, Text, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Project, User, Folder } from '@/types';
import { PrivateAxios } from '@/helpers/PrivateAxios';
import { Image } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getFolders, createFolder, toggleFolderVisibility } from '@/services/folderService';
import { getProjectFiles, toggleFileVisibility } from '@/services/fileService';
import { useEffect, useState } from 'react';

export default function ProjectPhotos({ project, user }: { project: any, user: any }) {
    const { colors } = useTheme();
    const router = useRouter();
    const [photos, setPhotos] = useState<any[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [folders, setFolders] = useState<any[]>([]);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchFolders = async () => {
            if (!project?.id) return;
            setLoading(true);
            try {
                const data = await getProjectFiles(project.id);
                if (data.folderData) {
                    setFolders(data.folderData);
                    let fetchedPhotos: any[] = [];
                    data.folderData.forEach((f: any) => {
                        if (f.files) {
                            fetchedPhotos = [...fetchedPhotos, ...f.files.filter((file: any) => file.file_type.includes('image'))];
                        }
                    });
                    setPhotos(fetchedPhotos);
                }
            } catch (error) {
                console.error("Error fetching folders:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchFolders();
    }, [project?.id]);

    const currentFolderPhotos = selectedFolder ? photos.filter((p) => p.folder_id === selectedFolder) : [];
    const visiblePhotos = user.role === 'client' ? currentFolderPhotos.filter((p) => p.client_visible !== false) : currentFolderPhotos;
    const currentFolder = folders.find((f) => f.id === selectedFolder);

    const togglePhotoVisibility = async (photo: any) => {
        try {
            await toggleFileVisibility(photo.id, !photo.client_visible);
            setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, client_visible: !photo.client_visible } : p)));
            Alert.alert('Updated', `Photo marked ${!photo.client_visible ? 'Visible' : 'Hidden'} for clients`);
        } catch (e) {
            Alert.alert('Error', 'Failed to toggle visibility');
        }
    };

    const toggleFolderVis = async (folder: any) => {
        try {
            await toggleFolderVisibility(folder.id, !folder.client_visible);
            setFolders((prev) => prev.map((f) => (f.id === folder.id ? { ...f, client_visible: !folder.client_visible } : f)));
            Alert.alert('Updated', `Folder marked ${!folder.client_visible ? 'Visible' : 'Hidden'} for clients`);
        } catch (err) {
            Alert.alert('Error', 'Failed to toggle visibility');
        }
    };

    const handleCreateFolder = async (newFolderName: string) => {
        if (!newFolderName.trim() || !project?.id) return;
        setSubmitting(true);
        try {
            const data = await createFolder({
                project_id: project.id,
                name: newFolderName.trim(),
                type: 'photos'
            });
            if (data.folder) {
                setFolders([...folders, data.folder]);
                setShowCreateFolder(false); // Changed from setModalVisible to setShowCreateFolder
                setNewFolderName('');
            }
        } catch (error) {
            console.error("Failed to create folder:", error);
            Alert.alert("Error", "Failed to create folder"); // Re-added Alert for user feedback
        } finally {
            setSubmitting(false);
        }
    };

    // Folder view
    if (!selectedFolder) {
        return (
            <View>
                {(user.role === 'admin' || user.role === 'contributor') && (
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                        <TouchableOpacity
                            onPress={() => Alert.alert('Info', 'Select a folder first')}
                            style={{ flex: 1, height: 38, borderRadius: 10, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                        >
                            <Feather name="upload" size={13} color="#fff" />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: 'white' }}>Upload</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowCreateFolder(true)}
                            style={{ height: 38, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 12 }}
                        >
                            <Feather name="folder-plus" size={13} color={colors.text} />
                            <Text style={{ fontSize: 12, color: colors.text }}>New Folder</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {folders.map((folder) => {
                        const count = photos.filter((p) => p.folder_id === folder.id).length;
                        return (
                            <TouchableOpacity
                                key={folder.id}
                                onPress={() => setSelectedFolder(folder.id)}
                                style={{ width: '30%', alignItems: 'center', gap: 4, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, padding: 12 }}
                            >
                                <Feather name="folder" size={32} color="#f97316" />
                                <Text numberOfLines={2} style={{ fontSize: 10, fontWeight: '500', color: colors.text, textAlign: 'center' }}>{folder.name}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Text style={{ fontSize: 9, color: colors.textMuted }}>{count} photos</Text>
                                    {(user.role === 'admin' || user.role === 'superadmin') && (
                                        <TouchableOpacity
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                toggleFolderVis(folder);
                                            }}
                                            style={{ padding: 2 }}
                                        >
                                            <Feather name={folder.client_visible !== false ? 'eye' : 'eye-off'} size={12} color={folder.client_visible !== false ? '#f97316' : colors.textMuted} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {folders.length === 0 && (
                    <View style={{ marginTop: 30, alignItems: 'center' }}>
                        <Feather name="folder" size={32} color={colors.border} />
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>No folders yet</Text>
                    </View>
                )}

                <Modal visible={showCreateFolder} transparent animationType="fade">
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
                        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 14 }}>New Folder</Text>
                            <View style={{ height: 40, borderRadius: 10, backgroundColor: colors.border, paddingHorizontal: 12, justifyContent: 'center', marginBottom: 16 }}>
                                <Text style={{ fontSize: 13, color: colors.textMuted }} onPress={() => { }}>
                                    {newFolderName || 'Folder name'}
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity onPress={() => setShowCreateFolder(false)} style={{ flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#444', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 13, color: colors.textMuted }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleCreateFolder(newFolderName || 'New Folder')} style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: 'white' }}>Create</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        );
    }

    // Photo grid view
    return (
        <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <TouchableOpacity onPress={() => setSelectedFolder(null)} style={{ padding: 6, borderRadius: 20 }}>
                    <Feather name="arrow-left" size={16} color="#fff" />
                </TouchableOpacity>
                <Feather name="folder" size={16} color="#f97316" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{currentFolder?.name}</Text>
            </View>

            {(user.role === 'admin' || user.role === 'contributor') && (
                <TouchableOpacity
                    onPress={() => router.push(`/(tabs)/upload?projectId=${project.id}&type=photos&folderId=${selectedFolder}`)}
                    style={{ height: 38, borderRadius: 10, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, marginBottom: 12 }}
                >
                    <Feather name="upload" size={13} color="#fff" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: 'white' }}>Upload Photos</Text>
                </TouchableOpacity>
            )}

            {/* 5-col photo grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
                {visiblePhotos.map((photo) => (
                    <TouchableOpacity
                        key={photo.id}
                        onPress={() => WebBrowser.openBrowserAsync(photo.downloadUrl)}
                        style={{
                            width: '18.5%',
                            aspectRatio: 1,
                            backgroundColor: colors.surface,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 4,
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        <Image source={{ uri: photo.downloadUrl }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                        {/* Overlay buttons */}
                        <View style={{ position: 'absolute', top: 2, right: 2, flexDirection: 'row', gap: 2 }}>
                            <TouchableOpacity
                                onPress={() => Alert.alert('Share', `Share photo - ${photo.location}`)}
                                style={{ backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: 2 }}
                            >
                                <Feather name="share-2" size={9} color="#aaa" />
                            </TouchableOpacity>
                            {user.role === 'admin' && (
                                <TouchableOpacity
                                    onPress={() => togglePhotoVisibility(photo)}
                                    style={{ backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: 2 }}
                                >
                                    <Feather name={photo.client_visible !== false ? 'eye' : 'eye-off'} size={9} color={photo.client_visible !== false ? '#f97316' : '#aaa'} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Expanded photo detail */}
            {expandedPhoto && (
                <View style={{ marginTop: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '500', color: colors.text, marginBottom: 4 }}>
                        {visiblePhotos.find((p) => p.id === expandedPhoto)?.file_name}
                    </Text>
                </View>
            )}

            {visiblePhotos.length === 0 && (
                <View style={{ marginTop: 30, alignItems: 'center' }}>
                    <Feather name="camera" size={32} color={colors.border} />
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>No photos yet</Text>
                </View>
            )}
        </View>
    );
}
