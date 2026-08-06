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
    BackHandler
} from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getProjectPhotosPaginated } from '@/services/projectService';
import FullScreenImageModal from '@/components/shared/FullScreenImageModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GAP = 8;
const IMAGE_SIZE = (SCREEN_WIDTH - 32 - (NUM_COLUMNS - 1) * GAP) / NUM_COLUMNS;

export default function PhotoLibraryScreen() {
    const { projectId } = useLocalSearchParams<{ projectId: string }>();
    const router = useRouter();
    const { colors } = useTheme();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();

    const [photos, setPhotos] = useState<any[]>([]);
    const [page, setPage] = useState<number>(1);
    const [loading, setLoading] = useState<boolean>(true);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);

    // Fullscreen viewer state
    const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);

    const isAdminUser = user?.role === 'admin' || user?.role === 'superadmin';

    const fetchPhotos = useCallback(async (pageNum: number, isRefresh: boolean = false) => {
        if (!projectId) return;

        try {
            if (isRefresh) {
                setRefreshing(true);
            } else if (pageNum === 1) {
                setLoading(true);
            } else {
                setLoadingMore(true);
            }

            const data = await getProjectPhotosPaginated(projectId, pageNum, 36); // 36 is multiple of 3
            const fetchedPhotos = data.photos || [];

            if (isRefresh || pageNum === 1) {
                setPhotos(fetchedPhotos);
            } else {
                setPhotos(prev => [...prev, ...fetchedPhotos]);
            }

            setPage(pageNum);
            setHasMore(pageNum < data.pagination.totalPages);
        } catch (error) {
            console.error('Fetch project photos failed:', error);
            Alert.alert('Error', 'Failed to load project photos.');
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setRefreshing(false);
        }
    }, [projectId]);

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

    const renderPhotoItem = ({ item }: { item: any }) => {
        const photoUrl = item.downloadUrl || item.file_url;
        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSelectedPhoto(item)}
                style={[styles.photoWrapper, { width: IMAGE_SIZE, height: IMAGE_SIZE, backgroundColor: colors.surface }]}
            >
                <Image
                    source={{ uri: photoUrl }}
                    style={styles.photo}
                    contentFit="cover"
                    transition={150}
                />
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
                    This project does not have any uploaded photos yet.
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

            {/* Fullscreen Image Modal */}
            <FullScreenImageModal
                visible={selectedPhoto !== null}
                onClose={() => setSelectedPhoto(null)}
                uri={selectedPhoto ? (selectedPhoto.downloadUrl || selectedPhoto.file_url) : null}
                folderName={selectedPhoto?.folder?.name}
                title={selectedPhoto?.file_name}
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
});
