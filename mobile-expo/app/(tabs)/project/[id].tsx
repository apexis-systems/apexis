import { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, BackHandler } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
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
import MainHeader from '@/components/shared/MainHeader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Tab = 'overview' | 'documents' | 'photos' | 'rfi' | 'reports' | 'snags' | 'sops';

export default function ProjectWorkspaceScreen() {
    const { id, tab, folderId } = useLocalSearchParams<{ id: string; tab?: string; folderId?: string }>();
    const { user } = useAuth();
    const { colors, isDark } = useTheme();
    const router = useRouter();

    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly'>('daily');

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
            const onBackPress = () => {
                if (activeTab !== 'overview') {
                    setActiveTab('overview');
                    return true;
                }
                router.push('/(tabs)');
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

    useEffect(() => {
        const fetchProject = async () => {
            try {
                const res = await PrivateAxios.get(`/projects/${id}`);
                setProject(res.data.project);
            } catch (error) {
                console.error("Failed to fetch project:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProject();
    }, [id]);

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
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                backgroundColor: colors.background,
            }}>
                <View>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                        {project.name.charAt(0).toUpperCase() + project.name.slice(1)}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                        {project.location ? (project.location.charAt(0).toUpperCase() + project.location.slice(1)) : 'Location not set'}
                    </Text>
                </View>
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
                                <Text
                                    style={{
                                        fontSize: 12,
                                        fontWeight: activeTab === tab.key ? '700' : '500',
                                        color: activeTab === tab.key ? colors.text : colors.textMuted,
                                    }}
                                >
                                    {tab.label}
                                </Text>
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
                        onActionPress={(actionId: string) => setActiveTab(actionId as Tab)}
                    />
                )}
                {activeTab === 'documents' && <ProjectDocuments project={project} user={user} initialFolderId={folderId} />}
                {activeTab === 'photos' && <ProjectPhotos project={project} user={user} initialFolderId={folderId} />}
                {activeTab === 'rfi' && <ProjectRFI project={project} user={user} />}

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
                        <ProjectSnagList project={project} />
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
        </SafeAreaView>
    );
}
