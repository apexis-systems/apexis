import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Project, User, ProjectDocument, Folder } from '@/types';
import { mockDocuments, mockFolders } from '@/data/mock';
import { useRouter } from 'expo-router';
import { PrivateAxios } from '@/helpers/PrivateAxios';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
    project: Project;
    user: User;
}

export default function ProjectDocuments({ project, user }: Props) {
    const { colors } = useTheme();
    const router = useRouter();
    const [docs, setDocs] = useState<ProjectDocument[]>(
        mockDocuments.filter((d) => d.projectId === project.id)
    );
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [folders, setFolders] = useState<any[]>([]);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    useEffect(() => {
        if (project?.id) {
            fetchFolders();
        }
    }, [project?.id]);

    const fetchFolders = async () => {
        try {
            const res = await PrivateAxios.get(`/folders?projectId=${project.id}`);
            setFolders(res.data);
        } catch (e) {
            console.error("Failed to fetch folders", e);
        }
    };

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

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            await PrivateAxios.post('/folders/create', { project_id: project.id, name: newFolderName.trim() });
            setNewFolderName('');
            setShowCreateFolder(false);
            fetchFolders();
        } catch (e) {
            console.error("Failed to create folder", e);
            Alert.alert("Error", "Failed to create folder");
        }
    };

    // Folder View
    if (!selectedFolder) {
        return (
            <View>
                {(user.role === 'admin' || user.role === 'contributor') && (
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
                            <Text style={{ fontSize: 12, fontWeight: '600', color: 'white' }}>Upload</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowCreateFolder(true)}
                            style={{
                                height: 38,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: colors.border,
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'row',
                                gap: 6,
                                paddingHorizontal: 12,
                            }}
                        >
                            <Feather name="folder-plus" size={13} color={colors.text} />
                            <Text style={{ fontSize: 12, color: colors.text }}>New Folder</Text>
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
                                    backgroundColor: colors.background,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    padding: 12,
                                }}
                            >
                                <Feather name="folder" size={32} color="#f97316" />
                                <Text numberOfLines={2} style={{ fontSize: 10, fontWeight: '500', color: colors.text, textAlign: 'center' }}>
                                    {folder.name}
                                </Text>
                                <Text style={{ fontSize: 9, color: colors.textMuted }}>{count} files</Text>
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

                {/* Create Folder Modal */}
                <Modal visible={showCreateFolder} transparent animationType="fade">
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
                        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 14 }}>New Folder</Text>
                            <TextInput
                                value={newFolderName}
                                onChangeText={setNewFolderName}
                                placeholder="Folder name"
                                placeholderTextColor="#555"
                                style={{ height: 40, borderRadius: 10, backgroundColor: colors.border, color: colors.text, paddingHorizontal: 12, fontSize: 13, marginBottom: 16 }}
                            />
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity onPress={() => setShowCreateFolder(false)} style={{ flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#444', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 13, color: colors.textMuted }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleCreateFolder} style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: 'white' }}>Create</Text>
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
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{currentFolder?.name}</Text>
            </View>

            {(user.role === 'admin' || user.role === 'contributor') && (
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
                    <Text style={{ fontSize: 12, fontWeight: '600', color: 'white' }}>Upload Document</Text>
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
                            backgroundColor: colors.background,
                            borderWidth: 1,
                            borderColor: colors.border,
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
                            <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: '600', color: colors.text }}>{doc.name}</Text>
                            <Text style={{ fontSize: 9, color: colors.textMuted }}>v{doc.version} · {doc.size}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                            <TouchableOpacity onPress={() => Alert.alert('Share', `Share ${doc.name}`)} style={{ padding: 4 }}>
                                <Feather name="share-2" size={14} color="#666" />
                            </TouchableOpacity>
                            {user.role === 'admin' && (
                                <TouchableOpacity onPress={() => toggleVisibility(doc.id)} style={{ padding: 4 }}>
                                    <Feather name={doc.clientVisible ? 'eye' : 'eye-off'} size={14} color={doc.clientVisible ? '#f97316' : colors.textMuted} />
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
                    <Feather name="file-text" size={32} color={colors.border} />
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>No documents yet</Text>
                </View>
            )}
        </View>
    );
}
