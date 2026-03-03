import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, TextInput, Share } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Project, User, Folder } from '@/types';
import { PrivateAxios } from '@/helpers/PrivateAxios';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getFolders, createFolder, toggleFolderVisibility } from '@/services/folderService';
import { getProjectFiles, deleteFile, toggleFileVisibility } from '@/services/fileService';

export default function ProjectDocuments({ project, user }: { project: any, user: any }) {
    const { colors } = useTheme();
    const router = useRouter();
    const [docs, setDocs] = useState<any[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [folders, setFolders] = useState<any[]>([]);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchFolders = async () => {
            if (!project?.id) return;
            setLoading(true);
            try {
                const data = await getProjectFiles(project.id);
                if (data.folderData) {
                    setFolders(data.folderData);
                    let fetchedDocs: any[] = [];
                    data.folderData.forEach((f: any) => {
                        if (f.files) {
                            fetchedDocs = [...fetchedDocs, ...f.files.filter((file: any) => !file.file_type?.startsWith('image/'))];
                        }
                    });
                    setDocs(fetchedDocs);
                }
            } catch (error) {
                console.error("Error fetching folders:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchFolders();
    }, [project?.id]);

    const currentFolderDocs = selectedFolder ? docs.filter((d) => d.folder_id === selectedFolder) : [];
    const visibleDocs = user.role === 'client' ? currentFolderDocs.filter((d) => d.client_visible !== false) : currentFolderDocs;
    const currentFolder = folders.find((f) => f.id === selectedFolder);

    const toggleDocVisibility = async (doc: any) => {
        try {
            await toggleFileVisibility(doc.id, !doc.client_visible);
            setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, client_visible: !doc.client_visible } : d)));
            Alert.alert('Updated', `Document marked ${!doc.client_visible ? 'Visible' : 'Hidden'} for clients`);
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

    const deleteDoc = async (docId: number) => {
        Alert.alert('Delete', 'Delete this document?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteFile(docId);
                        setDocs((prev) => prev.filter((d) => d.id !== docId));
                    } catch (err) {
                        Alert.alert("Error", "Failed to delete");
                    }
                }
            },
        ]);
    };

    const handleShare = async (doc: any) => {
        try {
            await Share.share({
                title: doc.file_name,
                message: `${doc.file_name}\n${doc.downloadUrl}`,
                url: doc.downloadUrl,   // iOS only
            });
        } catch (e) {
            console.error('Share error:', e);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim() || !project?.id) return;
        setSubmitting(true);
        try {
            const data = await createFolder({
                project_id: project.id,
                name: newFolderName.trim(),
                type: 'documents'
            });
            if (data.folder) {
                setFolders([...folders, data.folder]);
                setShowCreateFolder(false); // Changed from setModalVisible to setShowCreateFolder
                setNewFolderName('');
            }
        } catch (error) {
            console.error("Failed to create folder:", error);
            Alert.alert("Error", "Failed to create folder");
        } finally {
            setSubmitting(false);
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
                        const count = docs.filter((d) => d.folder_id === folder.id).length;
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
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Text style={{ fontSize: 9, color: colors.textMuted }}>{count} files</Text>
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
                    <TouchableOpacity
                        key={doc.id}
                        onPress={() => WebBrowser.openBrowserAsync(doc.downloadUrl)}
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
                                backgroundColor: doc.file_type.includes('pdf') ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Feather name="file-text" size={16} color={doc.file_type.includes('pdf') ? '#ef4444' : '#3b82f6'} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: '600', color: colors.text }}>{doc.file_name}</Text>
                            <Text style={{ fontSize: 9, color: colors.textMuted }}>{doc.file_size_mb} MB</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                            <TouchableOpacity onPress={() => handleShare(doc)} style={{ padding: 4 }}>
                                <Feather name="share-2" size={14} color="#666" />
                            </TouchableOpacity>
                            {user.role === 'admin' && (
                                <TouchableOpacity onPress={() => toggleDocVisibility(doc)} style={{ padding: 4 }}>
                                    <Feather name={doc.client_visible !== false ? 'eye' : 'eye-off'} size={14} color={doc.client_visible !== false ? '#f97316' : colors.textMuted} />
                                </TouchableOpacity>
                            )}
                            {(user.role === 'admin' || user.role === 'contributor') && doc.uploaderId === user.id && (
                                <TouchableOpacity onPress={() => deleteDoc(doc.id)} style={{ padding: 4 }}>
                                    <Feather name="trash-2" size={14} color="#ef4444" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </TouchableOpacity>
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
