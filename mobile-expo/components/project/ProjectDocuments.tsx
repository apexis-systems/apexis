import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Project, User, ProjectDocument, Folder } from '@/types';
import { mockDocuments, mockFolders } from '@/data/mock';
import { useRouter } from 'expo-router';

interface Props {
    project: Project;
    user: User;
}

export default function ProjectDocuments({ project, user }: Props) {
    const router = useRouter();
    const [docs, setDocs] = useState<ProjectDocument[]>(
        mockDocuments.filter((d) => d.projectId === project.id)
    );
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [folders, setFolders] = useState<Folder[]>(
        mockFolders.filter((f) => f.projectId === project.id && f.type === 'documents')
    );
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    const currentFolderDocs = selectedFolder ? docs.filter((d) => d.folderId === selectedFolder) : [];
    const visibleDocs = user.role === 'client' ? currentFolderDocs.filter((d) => d.clientVisible) : currentFolderDocs;
    const currentFolder = folders.find((f) => f.id === selectedFolder);

    const toggleVisibility = (docId: string) => {
        setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, clientVisible: !d.clientVisible } : d)));
        Alert.alert('Updated', 'Visibility updated');
    };

    const deleteDoc = (docId: string) => {
        Alert.alert('Delete', 'Delete this document?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => setDocs((prev) => prev.filter((d) => d.id !== docId)) },
        ]);
    };

    const handleCreateFolder = () => {
        if (!newFolderName.trim()) return;
        const newFolder: Folder = {
            id: `folder-doc-${Date.now()}`,
            projectId: project.id,
            name: newFolderName.trim(),
            type: 'documents',
        };
        setFolders((prev) => [...prev, newFolder]);
        setNewFolderName('');
        setShowCreateFolder(false);
    };

    // Folder View
    if (!selectedFolder) {
        return (
            <View>
                {user.role !== 'client' && (
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                        <TouchableOpacity
                            onPress={() => Alert.alert('Info', 'Select a folder first')}
                            style={{
                                flex: 1,
                                height: 38,
                                borderRadius: 10,
                                backgroundColor: '#f97316',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'row',
                                gap: 6,
                            }}
                        >
                            <Feather name="upload" size={13} color="#fff" />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>Upload</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowCreateFolder(true)}
                            style={{
                                height: 38,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: '#2a2a2a',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'row',
                                gap: 6,
                                paddingHorizontal: 12,
                            }}
                        >
                            <Feather name="folder-plus" size={13} color="#fff" />
                            <Text style={{ fontSize: 12, color: '#fff' }}>New Folder</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {folders.map((folder) => {
                        const count = docs.filter((d) => d.folderId === folder.id).length;
                        return (
                            <TouchableOpacity
                                key={folder.id}
                                onPress={() => setSelectedFolder(folder.id)}
                                style={{
                                    width: '30%',
                                    alignItems: 'center',
                                    gap: 4,
                                    borderRadius: 10,
                                    backgroundColor: '#111111',
                                    borderWidth: 1,
                                    borderColor: '#2a2a2a',
                                    padding: 12,
                                }}
                            >
                                <Feather name="folder" size={32} color="#f97316" />
                                <Text numberOfLines={2} style={{ fontSize: 10, fontWeight: '500', color: '#fff', textAlign: 'center' }}>
                                    {folder.name}
                                </Text>
                                <Text style={{ fontSize: 9, color: '#666' }}>{count} files</Text>
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

                {/* Create Folder Modal */}
                <Modal visible={showCreateFolder} transparent animationType="fade">
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
                        <View style={{ backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 14 }}>New Folder</Text>
                            <TextInput
                                value={newFolderName}
                                onChangeText={setNewFolderName}
                                placeholder="Folder name"
                                placeholderTextColor="#555"
                                style={{ height: 40, borderRadius: 10, backgroundColor: '#2a2a2a', color: '#fff', paddingHorizontal: 12, fontSize: 13, marginBottom: 16 }}
                            />
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity onPress={() => setShowCreateFolder(false)} style={{ flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#444', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 13, color: '#888' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleCreateFolder} style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Create</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        );
    }

    // Files View
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
                    onPress={() => router.push(`/(tabs)/upload?projectId=${project.id}&type=documents&folderId=${selectedFolder}`)}
                    style={{
                        height: 38,
                        borderRadius: 10,
                        backgroundColor: '#f97316',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 6,
                        marginBottom: 12,
                    }}
                >
                    <Feather name="upload" size={13} color="#fff" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>Upload Document</Text>
                </TouchableOpacity>
            )}

            <View style={{ gap: 6 }}>
                {visibleDocs.map((doc) => (
                    <View
                        key={doc.id}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            borderRadius: 10,
                            backgroundColor: '#111111',
                            borderWidth: 1,
                            borderColor: '#2a2a2a',
                            padding: 10,
                        }}
                    >
                        <View
                            style={{
                                width: 34,
                                height: 34,
                                borderRadius: 8,
                                backgroundColor: doc.type === 'pdf' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Feather name="file-text" size={16} color={doc.type === 'pdf' ? '#ef4444' : '#3b82f6'} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: '600', color: '#fff' }}>{doc.name}</Text>
                            <Text style={{ fontSize: 9, color: '#666' }}>v{doc.version} · {doc.size}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                            <TouchableOpacity onPress={() => Alert.alert('Share', `Share ${doc.name}`)} style={{ padding: 4 }}>
                                <Feather name="share-2" size={14} color="#666" />
                            </TouchableOpacity>
                            {user.role === 'admin' && (
                                <TouchableOpacity onPress={() => toggleVisibility(doc.id)} style={{ padding: 4 }}>
                                    <Feather name={doc.clientVisible ? 'eye' : 'eye-off'} size={14} color={doc.clientVisible ? '#f97316' : '#666'} />
                                </TouchableOpacity>
                            )}
                            {(user.role === 'admin' || user.role === 'contributor') && doc.uploaderId === user.id && (
                                <TouchableOpacity onPress={() => deleteDoc(doc.id)} style={{ padding: 4 }}>
                                    <Feather name="trash-2" size={14} color="#ef4444" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                ))}
            </View>

            {visibleDocs.length === 0 && (
                <View style={{ marginTop: 30, alignItems: 'center' }}>
                    <Feather name="file-text" size={32} color="#2a2a2a" />
                    <Text style={{ fontSize: 12, color: '#888', marginTop: 8 }}>No documents yet</Text>
                </View>
            )}
        </View>
    );
}
