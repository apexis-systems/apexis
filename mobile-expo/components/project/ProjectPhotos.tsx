import {
    View, Text, TouchableOpacity, Alert, Modal,
    TextInput, Image, FlatList, Dimensions, StatusBar,
    ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getFolders, createFolder, toggleFolderVisibility } from '@/services/folderService';
import { getProjectFiles, toggleFileVisibility } from '@/services/fileService';
import { useEffect, useState, useRef } from 'react';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function ProjectPhotos({ project, user }: { project: any; user: any }) {
    const { colors } = useTheme();
    const router = useRouter();
    const [photos, setPhotos] = useState<any[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [folders, setFolders] = useState<any[]>([]);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Viewer state
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(0);
    const [downloading, setDownloading] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        if (!project?.id) return;
        setLoading(true);
        getProjectFiles(project.id)
            .then((data) => {
                if (data.folderData) {
                    setFolders(data.folderData);
                    let allPhotos: any[] = [];
                    data.folderData.forEach((f: any) => {
                        if (f.files) {
                            allPhotos = [...allPhotos, ...f.files.filter((file: any) => file.file_type?.includes('image'))];
                        }
                    });
                    setPhotos(allPhotos);
                }
            })
            .catch((e) => console.error('fetchFiles', e))
            .finally(() => setLoading(false));
    }, [project?.id]);

    const currentFolderPhotos = selectedFolder ? photos.filter((p) => p.folder_id === selectedFolder) : [];
    const visiblePhotos = user.role === 'client'
        ? currentFolderPhotos.filter((p) => p.client_visible !== false)
        : currentFolderPhotos;
    const currentFolder = folders.find((f) => f.id === selectedFolder);

    // ── Viewer helpers ────────────────────────────────────────────────────────

    const openViewer = (index: number) => {
        setViewerIndex(index);
        setViewerOpen(true);
        setTimeout(() => flatListRef.current?.scrollToIndex({ index, animated: false }), 50);
    };

    const closeViewer = () => setViewerOpen(false);

    const goNext = () => {
        const next = Math.min(viewerIndex + 1, visiblePhotos.length - 1);
        setViewerIndex(next);
        flatListRef.current?.scrollToIndex({ index: next, animated: true });
    };

    const goPrev = () => {
        const prev = Math.max(viewerIndex - 1, 0);
        setViewerIndex(prev);
        flatListRef.current?.scrollToIndex({ index: prev, animated: true });
    };

    const downloadToGallery = async () => {
        const photo = visiblePhotos[viewerIndex];
        if (!photo?.downloadUrl) return;
        setDownloading(true);
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Allow access to save photos to your gallery.');
                return;
            }
            const ext = photo.file_name?.split('.').pop() || 'jpg';
            const localUri = (FileSystem as any).cacheDirectory + `apexis_${Date.now()}.${ext}`;
            const { uri } = await FileSystem.downloadAsync(photo.downloadUrl, localUri);
            await MediaLibrary.saveToLibraryAsync(uri);
            Alert.alert('Saved!', 'Photo saved to your gallery.');
        } catch (err) {
            console.error('Download error:', err);
            Alert.alert('Error', 'Failed to save photo.');
        } finally {
            setDownloading(false);
        }
    };

    // ── Toggle helpers ────────────────────────────────────────────────────────

    const togglePhotoVisibility = async (photo: any) => {
        try {
            await toggleFileVisibility(photo.id, !photo.client_visible);
            setPhotos((prev) => prev.map((p) => p.id === photo.id ? { ...p, client_visible: !photo.client_visible } : p));
        } catch {
            Alert.alert('Error', 'Failed to toggle visibility');
        }
    };

    const toggleFolderVis = async (folder: any) => {
        try {
            await toggleFolderVisibility(folder.id, !folder.client_visible);
            setFolders((prev) => prev.map((f) => f.id === folder.id ? { ...f, client_visible: !folder.client_visible } : f));
        } catch {
            Alert.alert('Error', 'Failed to toggle visibility');
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim() || !project?.id) return;
        setSubmitting(true);
        try {
            const data = await createFolder({ project_id: project.id, name: newFolderName.trim(), type: 'photos' });
            if (data.folder) {
                setFolders([...folders, data.folder]);
                setShowCreateFolder(false);
                setNewFolderName('');
            }
        } catch {
            Alert.alert('Error', 'Failed to create folder');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Full-screen viewer modal ───────────────────────────────────────────────

    const PhotoViewer = () => (
        <Modal visible={viewerOpen} transparent={false} animationType="fade" statusBarTranslucent onRequestClose={closeViewer}>
            <StatusBar hidden />
            <View style={{ flex: 1, backgroundColor: '#000' }}>
                {/* Top bar */}
                <View style={{
                    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                }}>
                    <TouchableOpacity onPress={closeViewer} style={{ padding: 8 }}>
                        <Feather name="x" size={22} color="#fff" />
                    </TouchableOpacity>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                        {viewerIndex + 1} / {visiblePhotos.length}
                    </Text>
                    <TouchableOpacity onPress={downloadToGallery} style={{ padding: 8 }} disabled={downloading}>
                        {downloading
                            ? <ActivityIndicator size="small" color="#f97316" />
                            : <Feather name="download" size={22} color="#f97316" />
                        }
                    </TouchableOpacity>
                </View>

                {/* Photo pager */}
                <FlatList
                    ref={flatListRef}
                    data={visiblePhotos}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.id.toString()}
                    getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
                    initialScrollIndex={viewerIndex}
                    onMomentumScrollEnd={(e) => {
                        const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                        setViewerIndex(idx);
                    }}
                    renderItem={({ item }) => (
                        <View style={{ width: SCREEN_W, height: SCREEN_H, justifyContent: 'center', alignItems: 'center' }}>
                            <Image
                                source={{ uri: item.downloadUrl }}
                                style={{ width: SCREEN_W, height: SCREEN_H }}
                                resizeMode="contain"
                            />
                        </View>
                    )}
                />

                {/* Prev / Next arrows */}
                {viewerIndex > 0 && (
                    <TouchableOpacity
                        onPress={goPrev}
                        style={{
                            position: 'absolute', left: 12, top: '50%',
                            backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 24, padding: 10,
                        }}
                    >
                        <Feather name="chevron-left" size={26} color="#fff" />
                    </TouchableOpacity>
                )}
                {viewerIndex < visiblePhotos.length - 1 && (
                    <TouchableOpacity
                        onPress={goNext}
                        style={{
                            position: 'absolute', right: 12, top: '50%',
                            backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 24, padding: 10,
                        }}
                    >
                        <Feather name="chevron-right" size={26} color="#fff" />
                    </TouchableOpacity>
                )}

                {/* Bottom info bar */}
                <View style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 32,
                }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                        {visiblePhotos[viewerIndex]?.file_name || 'Photo'}
                    </Text>
                    {visiblePhotos[viewerIndex]?.location ? (
                        <Text style={{ color: '#aaa', fontSize: 10, marginTop: 2 }}>
                            📍 {visiblePhotos[viewerIndex].location}
                        </Text>
                    ) : null}
                </View>
            </View>
        </Modal>
    );

    // ── Folder list ───────────────────────────────────────────────────────────

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

                {loading ? (
                    <ActivityIndicator color="#f97316" style={{ marginTop: 30 }} />
                ) : (
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
                                            <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggleFolderVis(folder); }} style={{ padding: 2 }}>
                                                <Feather name={folder.client_visible !== false ? 'eye' : 'eye-off'} size={12} color={folder.client_visible !== false ? '#f97316' : colors.textMuted} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {!loading && folders.length === 0 && (
                    <View style={{ marginTop: 30, alignItems: 'center' }}>
                        <Feather name="folder" size={32} color={colors.border} />
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>No folders yet</Text>
                    </View>
                )}

                {/* New Folder Modal */}
                <Modal visible={showCreateFolder} transparent animationType="fade">
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
                        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 14 }}>New Folder</Text>
                            <TextInput
                                value={newFolderName}
                                onChangeText={setNewFolderName}
                                placeholder="Folder name"
                                placeholderTextColor={colors.textMuted}
                                style={{ height: 40, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, fontSize: 13, marginBottom: 16 }}
                            />
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity onPress={() => setShowCreateFolder(false)} style={{ flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 13, color: colors.textMuted }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleCreateFolder} disabled={submitting} style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{submitting ? 'Creating…' : 'Create'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        );
    }

    // ── Photo grid ────────────────────────────────────────────────────────────

    return (
        <View>
            <PhotoViewer />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <TouchableOpacity onPress={() => setSelectedFolder(null)} style={{ padding: 6, borderRadius: 20 }}>
                    <Feather name="arrow-left" size={16} color={colors.text} />
                </TouchableOpacity>
                <Feather name="folder" size={16} color="#f97316" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{currentFolder?.name}</Text>
                <Text style={{ fontSize: 10, color: colors.textMuted, marginLeft: 4 }}>({visiblePhotos.length})</Text>
            </View>

            {(user.role === 'admin' || user.role === 'contributor') && (
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
                {visiblePhotos.map((photo, index) => (
                    <TouchableOpacity
                        key={photo.id}
                        onPress={() => openViewer(index)}
                        style={{ width: '18.5%', aspectRatio: 1, backgroundColor: colors.surface, borderRadius: 4, overflow: 'hidden', position: 'relative' }}
                    >
                        <Image source={{ uri: photo.downloadUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        <View style={{ position: 'absolute', top: 2, right: 2, flexDirection: 'row', gap: 2 }}>
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

            {visiblePhotos.length === 0 && (
                <View style={{ marginTop: 30, alignItems: 'center' }}>
                    <Feather name="camera" size={32} color={colors.border} />
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>No photos yet</Text>
                </View>
            )}
        </View>
    );
}
