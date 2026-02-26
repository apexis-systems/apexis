import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Project, User, ProjectPhoto, Folder } from '@/types';
import { mockPhotos, mockFolders } from '@/data/mock';
import { useRouter } from 'expo-router';

interface Props {
    project: Project;
    user: User;
}

export default function ProjectPhotos({ project, user }: Props) {
    const router = useRouter();
    const [photos, setPhotos] = useState<ProjectPhoto[]>(
        mockPhotos.filter((p) => p.projectId === project.id)
    );
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [folders, setFolders] = useState<Folder[]>(
        mockFolders.filter((f) => f.projectId === project.id && f.type === 'photos')
    );
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);

    const currentFolderPhotos = selectedFolder ? photos.filter((p) => p.folderId === selectedFolder) : [];
    const visiblePhotos = user.role === 'client' ? currentFolderPhotos.filter((p) => p.clientVisible) : currentFolderPhotos;
    const currentFolder = folders.find((f) => f.id === selectedFolder);

    const toggleVisibility = (photoId: string) => {
        setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, clientVisible: !p.clientVisible } : p)));
    };

    const handleCreateFolder = (name: string) => {
        const newFolder: Folder = {
            id: `folder-photo-${Date.now()}`,
            projectId: project.id,
            name,
            type: 'photos',
        };
        setFolders((prev) => [...prev, newFolder]);
        setShowCreateFolder(false);
        setNewFolderName('');
    };

    // Folder view
    if (!selectedFolder) {
        return (
            <View>
                {user.role !== 'client' && (
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                        <TouchableOpacity
                            onPress={() => Alert.alert('Info', 'Select a folder first')}
                            style={{ flex: 1, height: 38, borderRadius: 10, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                        >
                            <Feather name="upload" size={13} color="#fff" />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>Upload</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowCreateFolder(true)}
                            style={{ height: 38, borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 12 }}
                        >
                            <Feather name="folder-plus" size={13} color="#fff" />
                            <Text style={{ fontSize: 12, color: '#fff' }}>New Folder</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {folders.map((folder) => {
                        const count = photos.filter((p) => p.folderId === folder.id).length;
                        return (
                            <TouchableOpacity
                                key={folder.id}
                                onPress={() => setSelectedFolder(folder.id)}
                                style={{ width: '30%', alignItems: 'center', gap: 4, borderRadius: 10, backgroundColor: '#111111', borderWidth: 1, borderColor: '#2a2a2a', padding: 12 }}
                            >
                                <Feather name="folder" size={32} color="#f97316" />
                                <Text numberOfLines={2} style={{ fontSize: 10, fontWeight: '500', color: '#fff', textAlign: 'center' }}>{folder.name}</Text>
                                <Text style={{ fontSize: 9, color: '#666' }}>{count} photos</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {folders.length === 0 && (
                    <View style={{ marginTop: 30, alignItems: 'center' }}>
                        <Feather name="folder" size={32} color="#2a2a2a" />
                        <Text style={{ fontSize: 12, color: '#888', marginTop: 8 }}>No folders yet</Text>
                    </View>
                )}

                <Modal visible={showCreateFolder} transparent animationType="fade">
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
                        <View style={{ backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 14 }}>New Folder</Text>
                            <View style={{ height: 40, borderRadius: 10, backgroundColor: '#2a2a2a', paddingHorizontal: 12, justifyContent: 'center', marginBottom: 16 }}>
                                <Text style={{ fontSize: 13, color: '#555' }} onPress={() => { }}>
                                    {newFolderName || 'Folder name'}
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity onPress={() => setShowCreateFolder(false)} style={{ flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#444', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 13, color: '#888' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleCreateFolder(newFolderName || 'New Folder')} style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Create</Text>
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
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>{currentFolder?.name}</Text>
            </View>

            {user.role !== 'client' && (
                <TouchableOpacity
                    onPress={() => router.push(`/(tabs)/upload?projectId=${project.id}&type=photos&folderId=${selectedFolder}`)}
                    style={{ height: 38, borderRadius: 10, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, marginBottom: 12 }}
                >
                    <Feather name="upload" size={13} color="#fff" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>Upload Photos</Text>
                </TouchableOpacity>
            )}

            {/* 5-col photo grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
                {visiblePhotos.map((photo) => (
                    <TouchableOpacity
                        key={photo.id}
                        onPress={() => setExpandedPhoto(expandedPhoto === photo.id ? null : photo.id)}
                        style={{
                            width: '18.5%',
                            aspectRatio: 1,
                            backgroundColor: '#1e1e1e',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 4,
                            position: 'relative',
                        }}
                    >
                        <Feather name="camera" size={14} color="#333" />
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
                                    onPress={() => toggleVisibility(photo.id)}
                                    style={{ backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: 2 }}
                                >
                                    <Feather name={photo.clientVisible ? 'eye' : 'eye-off'} size={9} color={photo.clientVisible ? '#f97316' : '#aaa'} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Expanded photo detail */}
            {expandedPhoto && (
                <View style={{ marginTop: 10, borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', backgroundColor: '#111111', padding: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '500', color: '#fff', marginBottom: 4 }}>
                        {visiblePhotos.find((p) => p.id === expandedPhoto)?.location}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#888' }}>
                        {visiblePhotos.find((p) => p.id === expandedPhoto)?.tags.join(', ')}
                    </Text>
                </View>
            )}

            {visiblePhotos.length === 0 && (
                <View style={{ marginTop: 30, alignItems: 'center' }}>
                    <Feather name="camera" size={32} color="#2a2a2a" />
                    <Text style={{ fontSize: 12, color: '#888', marginTop: 8 }}>No photos yet</Text>
                </View>
            )}
        </View>
    );
}
