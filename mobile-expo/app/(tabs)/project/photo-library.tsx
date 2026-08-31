import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Alert,
    Dimensions,
    StyleSheet,
    RefreshControl,
    BackHandler,
    Modal,
    ScrollView
} from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getProjectPhotosPaginated, getProjects } from '@/services/projectService';
import { getOrgPhotosPaginated } from '@/services/organizationService';
import FullScreenImageModal from '@/components/shared/FullScreenImageModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GAP = 8;
const IMAGE_SIZE = (SCREEN_WIDTH - 32 - (NUM_COLUMNS - 1) * GAP) / NUM_COLUMNS;

export default function PhotoLibraryScreen() {
    const { projectId } = useLocalSearchParams<{ projectId?: string }>();
    const router = useRouter();
    const { colors } = useTheme();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();

    const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || 'all');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
    const [orgProjects, setOrgProjects] = useState<any[]>([]);
    const [showProjectPicker, setShowProjectPicker] = useState<boolean>(false);

    const [photos, setPhotos] = useState<any[]>([]);
    const [page, setPage] = useState<number>(1);
    const [loading, setLoading] = useState<boolean>(true);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);

    // Fullscreen viewer state
    const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);
    const [selectedIndex, setSelectedIndex] = useState<number>(0);

    const isAdminUser = user?.role === 'admin' || user?.role === 'superadmin';

    // Fetch projects for org filter if in global photo library
    useEffect(() => {
        if (isAdminUser && !projectId) {
            getProjects()
                .then(data => setOrgProjects(data.projects || []))
                .catch(err => console.error('Failed to load org projects:', err));
        }
    }, [isAdminUser, projectId]);

    const fetchPhotos = useCallback(async (pageNum: number, isRefresh: boolean = false, overrideProject?: string, overrideSort?: 'newest' | 'oldest') => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else if (pageNum === 1) {
                setLoading(true);
            } else {
                setLoadingMore(true);
            }

            const activeProjectId = overrideProject !== undefined ? overrideProject : selectedProjectId;
            const activeSort = overrideSort !== undefined ? overrideSort : sortOrder;

            const data = projectId
                ? await getProjectPhotosPaginated(projectId, pageNum, 36, activeSort)
                : await getOrgPhotosPaginated(pageNum, 36, undefined, activeProjectId, activeSort);
            const fetchedPhotos = data.photos || [];

            if (isRefresh || pageNum === 1) {
                setPhotos(fetchedPhotos);
            } else {
                setPhotos(prev => [...prev, ...fetchedPhotos]);
            }

            setPage(pageNum);
            setHasMore(pageNum < (data.pagination?.totalPages || 1));
        } catch (error) {
            console.error('Fetch photos failed:', error);
            Alert.alert('Error', 'Failed to load photos.');
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setRefreshing(false);
        }
    }, [projectId, selectedProjectId, sortOrder]);

    const handleBack = useCallback(() => {
        if (projectId) {
            router.replace({
                pathname: '/project/[id]',
                params: { id: projectId }
            });
            return true;
        }
        router.back();
        return true;
    }, [projectId, router]);

    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBack);
        return () => backHandler.remove();
    }, [handleBack]);

    useEffect(() => {
        if (!isAdminUser) {
            Alert.alert('Access Denied', 'Only administrators can view the photo library.', [
                { text: 'OK', onPress: () => router.back() }
            ]);
            return;
        }

        fetchPhotos(1);
    }, [fetchPhotos, isAdminUser, router]);

    const handleRefresh = () => {
        if (loading || loadingMore) return;
        fetchPhotos(1, true);
    };

    const handleLoadMore = () => {
        if (loading || loadingMore || !hasMore) return;
        fetchPhotos(page + 1);
    };

    const handleProjectSelect = (projId: string) => {
        setSelectedProjectId(projId);
        setShowProjectPicker(false);
        fetchPhotos(1, false, projId, sortOrder);
    };

    const handleSortChange = (newSort: 'newest' | 'oldest') => {
        setSortOrder(newSort);
        fetchPhotos(1, false, selectedProjectId, newSort);
    };

    const selectedProjectObj = orgProjects.find(p => String(p.id) === selectedProjectId);
    const selectedProjectLabel = selectedProjectId === 'all'
        ? 'All Projects'
        : (selectedProjectObj?.name || 'Selected Project');

    const renderPhotoItem = ({ item, index }: { item: any; index: number }) => {
        const photoUrl = item.downloadUrl || item.file_url;
        const isVideo = item.file_type?.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(photoUrl || item.file_name || '');
        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                    setSelectedPhoto(item);
                    setSelectedIndex(index);
                }}
                style={[styles.photoWrapper, { width: IMAGE_SIZE, height: IMAGE_SIZE, backgroundColor: colors.surface }]}
            >
                <Image
                    source={{ uri: photoUrl }}
                    style={styles.photo}
                    contentFit="cover"
                    transition={150}
                />
                {isVideo && (
                    <View style={styles.videoBadge}>
                        <Feather name="play" size={14} color="#fff" />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderFooter = () => {
        if (!loadingMore) return <View style={{ height: 20 }} />;
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
            </View>
        );
    };

    const renderEmpty = () => {
        if (loading) return null;
        return (
            <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconCircle, { backgroundColor: colors.surface }]}>
                    <Feather name="camera" size={32} color={colors.textMuted} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No Photos Found</Text>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    {projectId
                        ? 'This project does not have any uploaded photos yet.'
                        : selectedProjectId !== 'all'
                            ? 'No uploaded photos found for the selected project.'
                            : 'No uploaded photos found in this organization.'}
                </Text>
            </View>
        );
    };

    if (!isAdminUser) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={handleBack} style={styles.backBtn} accessibilityLabel="Go back">
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Photo Library</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Filter Bar */}
            <View style={[styles.filterBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                {!projectId && (
                    <TouchableOpacity
                        onPress={() => setShowProjectPicker(true)}
                        style={[styles.filterPill, { backgroundColor: colors.background, borderColor: colors.border }]}
                    >
                        <Feather name="folder" size={14} color={colors.primary} />
                        <Text style={[styles.filterPillText, { color: colors.text }]} numberOfLines={1}>
                            {selectedProjectLabel}
                        </Text>
                        <Feather name="chevron-down" size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    onPress={() => handleSortChange(sortOrder === 'newest' ? 'oldest' : 'newest')}
                    style={[styles.filterPill, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                    <Feather name={sortOrder === 'newest' ? 'arrow-down' : 'arrow-up'} size={14} color={colors.primary} />
                    <Text style={[styles.filterPillText, { color: colors.text }]}>
                        {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
                    </Text>
                </TouchableOpacity>
            </View>

            {loading && photos.length === 0 ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={photos}
                    renderItem={renderPhotoItem}
                    keyExtractor={(item) => String(item.id)}
                    numColumns={NUM_COLUMNS}
                    contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + 20 }]}
                    columnWrapperStyle={styles.columnWrapper}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={renderFooter}
                    ListEmptyComponent={renderEmpty}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={[colors.primary]}
                            tintColor={colors.primary}
                        />
                    }
                />
            )}

            {/* Project Selection Modal */}
            <Modal
                visible={showProjectPicker}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowProjectPicker(false)}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setShowProjectPicker(false)}
                    style={styles.modalOverlay}
                >
                    <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Filter by Project</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            <TouchableOpacity
                                onPress={() => handleProjectSelect('all')}
                                style={[
                                    styles.modalOption,
                                    selectedProjectId === 'all' && { backgroundColor: colors.primary + '15' }
                                ]}
                            >
                                <Text style={[
                                    styles.modalOptionText,
                                    { color: selectedProjectId === 'all' ? colors.primary : colors.text }
                                ]}>
                                    All Projects
                                </Text>
                                {selectedProjectId === 'all' && (
                                    <Feather name="check" size={16} color={colors.primary} />
                                )}
                            </TouchableOpacity>

                            {orgProjects.map((p) => {
                                const isSelected = String(p.id) === selectedProjectId;
                                return (
                                    <TouchableOpacity
                                        key={p.id}
                                        onPress={() => handleProjectSelect(String(p.id))}
                                        style={[
                                            styles.modalOption,
                                            isSelected && { backgroundColor: colors.primary + '15' }
                                        ]}
                                    >
                                        <Text style={[
                                            styles.modalOptionText,
                                            { color: isSelected ? colors.primary : colors.text }
                                        ]}>
                                            {p.name}
                                        </Text>
                                        {isSelected && (
                                            <Feather name="check" size={16} color={colors.primary} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Fullscreen Image Modal */}
            <FullScreenImageModal
                visible={selectedPhoto !== null}
                onClose={() => setSelectedPhoto(null)}
                photos={photos}
                initialIndex={selectedIndex}
                onIndexChange={(idx) => {
                    setSelectedIndex(idx);
                    if (photos[idx]) setSelectedPhoto(photos[idx]);
                }}
                uri={selectedPhoto ? (selectedPhoto.downloadUrl || selectedPhoto.file_url) : null}
                folderName={selectedPhoto?.folder?.name}
                title={selectedPhoto?.file_name}
                fileId={selectedPhoto?.id}
                projectId={projectId || selectedPhoto?.project?.id || selectedPhoto?.project_id}
                location={selectedPhoto?.location}
                tags={selectedPhoto?.tags}
                onFolderPress={(photo) => {
                    const targetPhoto = photo || selectedPhoto;
                    const targetFolderId = targetPhoto?.folder?.id;
                    const targetProjectId = projectId || targetPhoto?.project?.id || targetPhoto?.project_id;
                    if (targetProjectId && targetFolderId) {
                        setSelectedPhoto(null);
                        router.push({
                            pathname: '/project/[id]',
                            params: {
                                id: String(targetProjectId),
                                tab: 'photos',
                                folderId: String(targetFolderId),
                            },
                        });
                    }
                }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    backBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    filterBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
        maxWidth: '50%',
    },
    filterPillText: {
        fontSize: 12,
        fontWeight: '600',
        flexShrink: 1,
    },
    listContainer: {
        padding: 16,
        flexGrow: 1,
    },
    columnWrapper: {
        justifyContent: 'flex-start',
        gap: GAP,
        marginBottom: GAP,
    },
    photoWrapper: {
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
    },
    photo: {
        width: '100%',
        height: '100%',
    },
    videoBadge: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    footerLoader: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 80,
    },
    emptyIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 6,
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: 32,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        maxHeight: 400,
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 12,
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 4,
    },
    modalOptionText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
