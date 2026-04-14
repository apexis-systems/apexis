import { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, BackHandler } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSocket } from '@/contexts/SocketContext';
import { PrivateAxios } from '@/helpers/PrivateAxios';
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


const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Tab = 'overview' | 'documents' | 'photos' | 'rfi' | 'reports' | 'snags' | 'sops';

export default function ProjectWorkspaceScreen() {
    const { id, tab, folderId: qFolderId, initialFolderId: qInitialFolderId, rfiId, snagId, fileId, photoId } = useLocalSearchParams<{ id: string; tab?: string; folderId?: string; initialFolderId?: string; rfiId?: string; snagId?: string; fileId?: string; photoId?: string }>();
    const folderId = qFolderId || qInitialFolderId;
    const { user } = useAuth();
    const { colors, isDark } = useTheme();
    const router = useRouter();

    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState<Tab>(() => user?.role === 'client' ? 'documents' : 'overview');
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
            const defaultTab = user?.role === 'client' ? 'documents' : 'overview';
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

    useEffect(() => {
        if (tab && ['overview', 'documents', 'photos', 'rfi', 'reports', 'snags', 'sops'].includes(tab)) {
            setActiveTab(tab as Tab);
        }
    }, [tab]);

    const fetchProject = useCallback(async () => {
        try {
            const res = await PrivateAxios.get(`/projects/${id}`);
            setProject(res.data.project);
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

    type TabDef = { key: Tab; label: string; hideForClient?: boolean };
    const tabs: TabDef[] = [
        { key: 'overview', label: 'Overview', hideForClient: true },
        { key: 'documents', label: 'Docs' },
        { key: 'photos', label: 'Photos' },
        { key: 'rfi', label: 'RFI' },
    ];

    const visibleTabs = tabs.filter((t) => !(t.hideForClient && user.role === 'client'));

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
            <MainHeader
                showBack
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search in project..."
            />

            {/* Project Title Header */}
            <View style={{
                paddingHorizontal: 16,
                paddingVertical: 16,
                backgroundColor: colors.background,
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text }}>
                        {project.name.charAt(0).toUpperCase() + project.name.slice(1)}
                    </Text>
                    {user.role === 'admin' && (
                        <TouchableOpacity 
                            onPress={() => { setIsEditModalOpen(true); setEditModalFocus(null); }}
                            style={{ padding: 4 }}
                        >
                            <Feather name="edit-3" size={18} color={colors.primary} />
                        </TouchableOpacity>
                    )}
                </View>
                {project.description && (
                    <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4, lineHeight: 18 }}>
                        {project.description}
                    </Text>
                )}
            </View>



            {/* Tab Bar */}
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
                                onPress={() => {
                                    setActiveTab(tab.key);
                                    router.setParams({ folderId: '' });
                                }}
                                style={{
                                    flex: 1,
                                    borderRadius: 10,
                                    paddingVertical: 10,
                                    alignItems: 'center',
                                    backgroundColor: activeTab === tab.key ? colors.surface : 'transparent',
                                    // Subtle shadow for active tab
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
                {activeTab === 'overview' && user.role !== 'client' && (
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
                                setActiveTab(actionId as Tab);
                            }
                        }}
                    />
                )}
                {activeTab === 'documents' && <ProjectDocuments project={project} user={user} initialFolderId={folderId} initialFileId={fileId} />}
                {activeTab === 'photos' && <ProjectPhotos project={project} user={user} initialFolderId={folderId} initialFileId={fileId || photoId} />}
                {activeTab === 'rfi' && <ProjectRFI project={project} user={user} onUpdate={checkRFIs} initialRfiId={rfiId} />}

                {/* Internal / Hidden Tabs */}
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
                {activeTab === 'snags' && (
                    <View style={{ flex: 1 }} {...panHandlers}>
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
                    <View style={{ flex: 1 }} {...panHandlers}>
                        <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <TouchableOpacity onPress={() => setActiveTab('overview')}>
                                <Feather name="arrow-left" size={20} color={colors.text} />
                            </TouchableOpacity>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>SOPs & Manuals</Text>
                        </View>
                        <ProjectManuals project={project} />
                    </View>
                )}

            </View>

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

