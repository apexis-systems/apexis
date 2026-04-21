import { useState, useEffect, useCallback, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, BackHandler, FlatList, Platform, Alert } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSocket } from '@/contexts/SocketContext';
import { getProjectById, deleteProject } from '@/services/projectService';
import { PanResponder, Dimensions } from 'react-native';
import ProjectOverview from '@/components/project/ProjectOverview';
import ProjectDocuments from '@/components/project/ProjectDocuments';
import ProjectPhotos from '@/components/project/ProjectPhotos';
import ProjectRFI from '@/components/project/ProjectRFI';
import ProjectDailyReports from '@/components/project/ProjectDailyReports';
import ProjectWeeklyReports from '@/components/project/ProjectWeeklyReports';
import ProjectMonthlyReports from '@/components/project/ProjectMonthlyReports';
import ProjectSnagList from '@/components/project/ProjectSnagList';

import ProjectManuals from '@/components/project/ProjectManuals';
import { getRFIs } from '@/services/rfiService';
import MainHeader from '@/components/shared/MainHeader';
import EditProjectModal from '@/components/project/EditProjectModal';
import * as ScreenCapture from 'expo-screen-capture';
import { setActiveProjectContext } from '@/utils/projectSelection';


const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Tab = 'overview' | 'documents' | 'photos' | 'rfi' | 'reports' | 'snags' | 'sops';

// Stable reference — defined outside component so it's never recreated per render
const FLATLIST_TABS: Tab[] = ['overview', 'documents', 'photos', 'rfi'];

export default function ProjectWorkspaceScreen() {
    const { id, tab, folderId: qFolderId, initialFolderId: qInitialFolderId, rfiId, snagId, fileId, photoId } = useLocalSearchParams<{ id: string; tab?: string; folderId?: string; initialFolderId?: string; rfiId?: string; snagId?: string; fileId?: string; photoId?: string }>();
    const folderId = qFolderId || qInitialFolderId;
    const { user, isScreenCaptureProtected } = useAuth();
    const { colors, isDark } = useTheme();
    const router = useRouter();

    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);

    const initialTabKey = (tab && FLATLIST_TABS.includes(tab as Tab) ? tab : 'overview') as Tab;
    const [activeTab, setActiveTab] = useState<Tab>(initialTabKey);
    const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editModalFocus, setEditModalFocus] = useState<'start_date' | 'end_date' | null>(null);
    const [hasPendingRFI, setHasPendingRFI] = useState(false);


    const [searchQuery, setSearchQuery] = useState('');

    const panResponder = PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
            return Math.abs(gestureState.dx) > 10 && gestureState.dx > 40 && Math.abs(gestureState.dy) < 30;
        },
        onPanResponderRelease: (_, gestureState) => {
            if (gestureState.dx > SCREEN_WIDTH * 0.2) {
                if (['reports', 'snags', 'sops'].includes(activeTab)) {
                    setActiveTab('overview');
                }
            }
        },
    });
    const panHandlers = ['reports', 'snags', 'sops'].includes(activeTab) ? panResponder.panHandlers : {};

    useFocusEffect(
        useCallback(() => {
            const defaultTab = 'overview';
            const onBackPress = () => {
                if (activeTab !== defaultTab) {
                    setActiveTab(defaultTab as Tab);
                    return true;
                }
                router.push('/');
                return true;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [activeTab])
    );

    // EXTERNAL navigation effect — handles incoming deep links, notifications, activity taps.
    // suppressNavEffect prevents this from firing for our own internal router.setParams calls
    // (handleTabPress, onSwipeSettled) which would cause a scroll feedback loop.
    useEffect(() => {
        if (!tab) return;

        // Skip if triggered by our own internal setParams (swipe settle / tab press)
        if (suppressNavEffect.current) {
            suppressNavEffect.current = false;
            return;
        }

        if (!['overview', 'documents', 'photos', 'rfi', 'reports', 'snags', 'sops'].includes(tab)) return;

        setActiveTab(tab as Tab);
        const targetIndex = visibleTabs.findIndex(t => t.key === tab);
        if (targetIndex !== -1) {
            ignoreScrollSync.current = true;
            setTimeout(() => {
                flatListRef.current?.scrollToIndex({ index: targetIndex, animated: false });
                setTimeout(() => { ignoreScrollSync.current = false; }, 350);
            }, 150);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, fileId, folderId, rfiId, snagId, photoId, id, qInitialFolderId]);

    const fetchProject = useCallback(async () => {
        try {
            const projectData = await getProjectById(id as string);
            setProject(projectData);
        } catch (error) {
            console.error("Failed to fetch project:", error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchProject();
    }, [fetchProject]);

    const checkRFIs = useCallback(async () => {
        if (!id || !user?.id) return;
        try {
            const rfis = await getRFIs(Number(id));
            const pending = rfis.some(r =>
                (r.status === 'open' || r.status === 'overdue') &&
                String(r.assigned_to) === String(user.id)
            );
            setHasPendingRFI(pending);
        } catch (error) {
            console.error("Failed to check RFIs:", error);
        }
    }, [id, user?.id]);

    const { socket, isConnected } = useSocket();

    useEffect(() => {
        if (project?.id) {
            const contextType = activeTab === 'documents' ? 'document' : (activeTab === 'photos' ? 'photo' : null);
            setActiveProjectContext(project.id, folderId || null, contextType);
        }
    }, [project?.id, activeTab, folderId]);

    useEffect(() => {
        checkRFIs();
        const interval = setInterval(checkRFIs, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [checkRFIs]);

    // Socket listeners for real-time red dot updates
    useEffect(() => {
        if (socket && isConnected && id) {
            socket.emit('join-project', id);

            const handleRfiUpdate = () => {
                console.log('[SOCKET] RFI update received, refreshing red dot');
                checkRFIs();
            };

            socket.on('rfi-updated', handleRfiUpdate);
            socket.on('project-stats-updated', fetchProject);
            socket.on('new-notification', (notif: any) => {
                if (notif.type?.startsWith('rfi_')) {
                    handleRfiUpdate();
                }
            });

            return () => {
                socket.off('rfi-updated', handleRfiUpdate);
                socket.off('project-stats-updated', fetchProject);
                socket.off('new-notification', handleRfiUpdate);
            };
        }
    }, [socket, isConnected, id, checkRFIs]);

    type TabDef = { key: Tab; label: string; hideForClient?: boolean };
    const tabs: TabDef[] = [
        { key: 'overview', label: 'Overview' },
        { key: 'documents', label: 'Docs' },
        { key: 'photos', label: 'Photos' },
        { key: 'rfi', label: 'RFI' },
    ];

    const visibleTabs = tabs.filter((t) => !(t.hideForClient && user?.role === 'client'));

    const flatListRef = useRef<FlatList<TabDef>>(null);
    const ignoreScrollSync = useRef(false);
    // Set to true before any internal router.setParams so useEffect([tab]) skips the scroll.
    // External navigations (notifications, deep links) leave this false → effect runs normally.
    const suppressNavEffect = useRef(false);

    // Sync button press with FlatList
    const handleTabPress = (tabKey: Tab) => {
        if (activeTab === tabKey) return;
        ignoreScrollSync.current = true;
        setActiveTab(tabKey);
        // Suppress the nav effect — this is an internal change, not a deep link.
        // Safety timeout: reset in case params don't change (no-op setParams → no re-render → effect never fires).
        suppressNavEffect.current = true;
        setTimeout(() => { suppressNavEffect.current = false; }, 100);
        router.setParams({ tab: tabKey, folderId: '', initialFolderId: '', fileId: '', photoId: '', rfiId: '', snagId: '' });
        const index = visibleTabs.findIndex(t => t.key === tabKey);
        if (index !== -1) {
            flatListRef.current?.scrollToIndex({ index, animated: true });
        }
        setTimeout(() => { ignoreScrollSync.current = false; }, 400);
    };

    // Helper to render the content for a specific tab
    const renderTabScene = (tabKey: Tab) => {
        if (!user) return null;

        switch (tabKey) {
            case 'overview':
                return (
                    <ProjectOverview
                        project={project}
                        userRole={user.role}
                        onUpdate={(updated) => setProject(updated)}
                        onActionPress={(actionId: string) => {
                            if (actionId === 'edit-start') {
                                setEditModalFocus('start_date');
                                setIsEditModalOpen(true);
                            } else if (actionId === 'edit-end') {
                                setEditModalFocus('end_date');
                                setIsEditModalOpen(true);
                            } else {
                                handleTabPress(actionId as Tab);
                            }
                        }}
                    />
                );
            case 'documents':
                return <ProjectDocuments project={project} user={user} initialFolderId={tab === 'documents' ? folderId : undefined} initialFileId={fileId} />;
            case 'photos':
                return <ProjectPhotos project={project} user={user} initialFolderId={tab === 'photos' ? folderId : undefined} initialFileId={fileId || photoId} />;
            case 'rfi':
                return <ProjectRFI project={project} user={user} onUpdate={checkRFIs} initialRfiId={rfiId} />;
            default:
                return null;
        }
    };

    // Instant sync scroll with header highlight ONLY — no URL changes here
    // (URL changes here caused router.setParams to fire 60x/sec, triggering the
    //  useEffect([tab]) on every frame and creating a scroll feedback loop)
    const onScroll = useCallback((e: any) => {
        if (ignoreScrollSync.current) return;
        const xOffset = e.nativeEvent.contentOffset.x;
        const decimalIndex = xOffset / SCREEN_WIDTH;
        const index = Math.round(decimalIndex);

        // Sticky syncing: Only update header when we are 80% into the target page
        // This prevents the header from 'flickering' through intermediate tabs
        const distanceToPage = Math.abs(decimalIndex - index);
        if (distanceToPage > 0.2) return;

        if (visibleTabs[index] && visibleTabs[index].key !== activeTab) {
            setActiveTab(visibleTabs[index].key);
        }
    }, [activeTab, visibleTabs]);

    // Fires ONCE per swipe after it fully settles — safe place to sync the URL.
    // suppressNavEffect prevents the URL update from re-triggering the external nav effect.
    const onSwipeSettled = useCallback((e: any) => {
        if (ignoreScrollSync.current) {
            ignoreScrollSync.current = false;
            return;
        }
        const xOffset = e?.nativeEvent?.contentOffset?.x ?? 0;
        const index = Math.round(xOffset / SCREEN_WIDTH);
        const settledTab = visibleTabs[index]?.key;
        if (settledTab) {
            // Suppress the effect — this is an internal swipe, not external navigation.
            // Safety timeout: if params are unchanged (no-op), the effect won't fire to reset
            // the flag — so we reset it here after 100ms to avoid silently swallowing the
            // next external navigation (activity/notification tap).
            suppressNavEffect.current = true;
            setTimeout(() => { suppressNavEffect.current = false; }, 100);
            router.setParams({ tab: settledTab, folderId: '', initialFolderId: '', fileId: '', photoId: '', rfiId: '', snagId: '' });
        }
    }, [visibleTabs]);

    const stopIgnoring = useCallback(() => {
        ignoreScrollSync.current = false;
    }, []);

    // Initial scroll sync — runs once per project (when id changes).
    // IMPORTANT: do NOT use `activeTab` here — its closure value is always
    // 'overview' (the default) because state updates from sibling effects
    // aren't reflected yet. Read `tab` directly from the URL params instead.
    useEffect(() => {
        const targetKey = (tab && ['overview', 'documents', 'photos', 'rfi'].includes(tab))
            ? tab as Tab
            : 'overview';
        const index = visibleTabs.findIndex(t => t.key === targetKey);
        if (index !== -1) {
            setTimeout(() => {
                flatListRef.current?.scrollToIndex({ index, animated: false });
            }, 100);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]); // Reset when project changes — intentionally excludes `tab` from deps

    // Centralized Screen Capture Protection for the entire Project Workspace
    // Note: On iOS, expo-screen-capture can cause a total black screen for the user 
    // even during normal viewing on certain devices/simulators.
    // We only enable it for Android for now to ensure iOS visibility is restored.
    useEffect(() => {
        const updateProtection = async () => {
            try {
                if (isScreenCaptureProtected && Platform.OS === 'android') {
                    await ScreenCapture.preventScreenCaptureAsync('project-workspace');
                } else {
                    // If protection is disabled or we are on iOS, allow screen capture
                    await ScreenCapture.allowScreenCaptureAsync('project-workspace').catch(() => { });
                }
            } catch (error) {
                console.warn('Failed to update ScreenCapture protection', error);
            }
        };
        updateProtection();
        return () => {
            if (Platform.OS === 'android') {
                ScreenCapture.allowScreenCaptureAsync('project-workspace').catch(() => { });
            }
        };
    }, [id, isScreenCaptureProtected]); // Reset when project changes or toggle changes

    const isMainTab = visibleTabs.some(t => t.key === activeTab);
    const handleDeleteProject = () => {
        Alert.alert(
            "Delete Project",
            "Are you sure you want to permanently delete this project? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setIsDeleting(true);
                            await deleteProject(id as string);
                            router.replace('/');
                        } catch (error) {
                            console.error("Failed to delete project:", error);
                            Alert.alert("Error", "Failed to delete project. Please try again.");
                        } finally {
                            setIsDeleting(false);
                        }
                    }
                }
            ]
        );
    };

    if (!user || loading) return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
        </SafeAreaView>
    );

    if (!project) return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: colors.text }}>Project not found</Text>
        </SafeAreaView>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
            <MainHeader
                showBack
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search in project..."
            />

            {isDeleting ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ marginTop: 16, color: colors.textMuted, fontSize: 16, fontWeight: '600' }}>Deleting project...</Text>
                </View>
            ) : (
                <>
                    {/* Project Title Header */}
                    <View style={{
                        paddingHorizontal: 16,
                        paddingVertical: 16,
                        backgroundColor: colors.background,
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text, flex: 1 }} numberOfLines={1}>
                                {project.name.charAt(0).toUpperCase() + project.name.slice(1)}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                {user.role === 'admin' && (
                                    <TouchableOpacity
                                        onPress={() => { setIsEditModalOpen(true); setEditModalFocus(null); }}
                                        style={{ padding: 4 }}
                                    >
                                        <Feather name="edit-3" size={18} color={colors.primary} />
                                    </TouchableOpacity>
                                )}
                                {user.role === 'admin' && (
                                    <TouchableOpacity
                                        onPress={handleDeleteProject}
                                        style={{ padding: 4 }}
                                    >
                                        <Feather name="trash-2" size={18} color="#ef4444" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                        {project.description && (
                            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4, lineHeight: 18 }}>
                                {project.description}
                            </Text>
                        )}
                    </View>

                    {/* Tab Bar (Sticky only for main tabs) */}
                    <View style={{ backgroundColor: colors.background }}>
                        <View style={{
                            paddingHorizontal: 12,
                            paddingBottom: 0,
                            paddingTop: 8,
                        }}>
                            <View style={{
                                flexDirection: 'row',
                                backgroundColor: isDark ? colors.border : '#e2e8f0',
                                borderRadius: 12,
                                padding: 4,
                                gap: 2
                            }}>
                                {visibleTabs.map((tab) => (
                                    <TouchableOpacity
                                        key={tab.key}
                                        onPress={() => handleTabPress(tab.key)}
                                        style={{
                                            flex: 1,
                                            borderRadius: 10,
                                            paddingVertical: 10,
                                            alignItems: 'center',
                                            backgroundColor: activeTab === tab.key ? colors.surface : 'transparent',
                                            ...(activeTab === tab.key && !isDark ? {
                                                shadowColor: '#000',
                                                shadowOffset: { width: 0, height: 1 },
                                                shadowOpacity: 0.1,
                                                shadowRadius: 2,
                                                elevation: 2,
                                            } : {})
                                        }}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text
                                                style={{
                                                    fontSize: 12,
                                                    fontWeight: activeTab === tab.key ? '700' : '500',
                                                    color: activeTab === tab.key ? colors.text : colors.textMuted,
                                                }}
                                            >
                                                {tab.label}
                                            </Text>
                                            {tab.key === 'rfi' && hasPendingRFI && (
                                                <View style={{
                                                    width: 6,
                                                    height: 6,
                                                    borderRadius: 3,
                                                    backgroundColor: colors.primary,
                                                    marginLeft: 4,
                                                    marginTop: -6
                                                }} />
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>

                    {/* Tab Content */}
                    <View style={{ flex: 1 }}>
                        {isMainTab ? (
                            <FlatList
                                ref={flatListRef}
                                data={visibleTabs}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                keyExtractor={(item) => item.key}
                                renderItem={({ item }) => (
                                    <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
                                        {renderTabScene(item.key)}
                                    </View>
                                )}
                                onScroll={onScroll}
                                onMomentumScrollEnd={onSwipeSettled}
                                onScrollEndDrag={stopIgnoring}
                                scrollEventThrottle={16}
                                getItemLayout={(_, index) => ({
                                    length: SCREEN_WIDTH,
                                    offset: SCREEN_WIDTH * index,
                                    index,
                                })}
                                initialScrollIndex={visibleTabs.findIndex(t => t.key === initialTabKey)}
                                windowSize={Platform.OS === 'ios' ? 5 : 2}
                                initialNumToRender={Platform.OS === 'ios' ? 2 : 1}
                                maxToRenderPerBatch={Platform.OS === 'ios' ? 2 : 1}
                                removeClippedSubviews={Platform.OS === 'android'}
                                style={{ backgroundColor: colors.background }}
                            />
                        ) : (
                            <View style={{ flex: 1 }}>
                                {activeTab === 'snags' && (
                                    <View style={{ flex: 1 }}>
                                        <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <TouchableOpacity onPress={() => setActiveTab('overview')}>
                                                <Feather name="arrow-left" size={20} color={colors.text} />
                                            </TouchableOpacity>
                                            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Snags & Issues</Text>
                                        </View>
                                        <ProjectSnagList project={project} initialSnagId={snagId} />
                                    </View>
                                )}
                                {activeTab === 'sops' && (
                                    <View style={{ flex: 1 }}>
                                        <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <TouchableOpacity onPress={() => setActiveTab('overview')}>
                                                <Feather name="arrow-left" size={20} color={colors.text} />
                                            </TouchableOpacity>
                                            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>SOPs & Manuals</Text>
                                        </View>
                                        <ProjectManuals project={project} />
                                    </View>
                                )}
                                {activeTab === 'reports' && (
                                    <View style={{ flex: 1 }} {...panHandlers}>
                                        <View style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                <TouchableOpacity onPress={() => setActiveTab('overview')}>
                                                    <Feather name="arrow-left" size={20} color={colors.text} />
                                                </TouchableOpacity>
                                                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Reports</Text>
                                            </View>

                                            <View style={{ flexDirection: 'row', backgroundColor: isDark ? colors.border : '#e2e8f0', borderRadius: 8, padding: 2 }}>
                                                <TouchableOpacity
                                                    onPress={() => setReportType('daily')}
                                                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: reportType === 'daily' ? colors.surface : 'transparent' }}
                                                >
                                                    <Text style={{ fontSize: 11, fontWeight: '600', color: reportType === 'daily' ? colors.text : colors.textMuted }}>Daily</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => setReportType('weekly')}
                                                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: reportType === 'weekly' ? colors.surface : 'transparent' }}
                                                >
                                                    <Text style={{ fontSize: 11, fontWeight: '600', color: reportType === 'weekly' ? colors.text : colors.textMuted }}>Weekly</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => setReportType('monthly')}
                                                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: reportType === 'monthly' ? colors.surface : 'transparent' }}
                                                >
                                                    <Text style={{ fontSize: 11, fontWeight: '600', color: reportType === 'monthly' ? colors.text : colors.textMuted }}>Monthly</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                        {reportType === 'daily' ? (
                                            <ProjectDailyReports project={project} userRole={user.role} />
                                        ) : reportType === 'weekly' ? (
                                            <ProjectWeeklyReports project={project} userRole={user.role} />
                                        ) : (
                                            <ProjectMonthlyReports project={project} userRole={user.role} />
                                        )}
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                </>
            )}

            <EditProjectModal
                isOpen={isEditModalOpen}
                onClose={() => { setIsEditModalOpen(false); setEditModalFocus(null); }}
                project={project}
                onUpdate={(updated) => setProject(updated)}
                initialFocus={editModalFocus}
            />
        </SafeAreaView>
    );
}
