import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { PrivateAxios } from '@/helpers/PrivateAxios';
import ProjectOverview from '@/components/project/ProjectOverview';
import ProjectDocuments from '@/components/project/ProjectDocuments';
import ProjectPhotos from '@/components/project/ProjectPhotos';
import ProjectDailyReports from '@/components/project/ProjectDailyReports';
import ProjectWeeklyReports from '@/components/project/ProjectWeeklyReports';
import ProjectSnagList from '@/components/project/ProjectSnagList';
import ProjectManuals from '@/components/project/ProjectManuals';

type Tab = 'overview' | 'documents' | 'photos' | 'reports' | 'snags' | 'manuals';

export default function ProjectWorkspaceScreen() {
    const { id, tab, folderId } = useLocalSearchParams<{ id: string; tab?: string; folderId?: string }>();
    const { user } = useAuth();
    const { colors, isDark } = useTheme();
    const router = useRouter();

    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const defaultTab: Tab = (tab as Tab) || (user?.role === 'client' ? 'documents' : 'overview');
    const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
    const [reportType, setReportType] = useState<'daily' | 'weekly'>('daily');

    useEffect(() => {
        if (tab && ['overview', 'documents', 'photos', 'reports', 'snags', 'manuals'].includes(tab)) {
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
        { key: 'reports', label: 'Reports', hideForClient: true },
        { key: 'snags', label: 'Snags', hideForClient: true },
        { key: 'manuals', label: 'SOPs', hideForClient: true },
    ];

    const visibleTabs = tabs.filter((t) => !(t.hideForClient && user.role === 'client'));

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Header */}
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                    backgroundColor: colors.surface,
                }}
            >
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
                    <Feather name="arrow-left" size={20} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                        {project.name}
                    </Text>
                    {/* <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>{project.location || 'Location not set'}</Text> */}
                </View>
            </View>

            {/* Tab Bar */}
            <View style={{ backgroundColor: colors.surface }}>
                <View style={{
                    paddingHorizontal: 8,
                    paddingBottom: 14,
                    paddingTop: 4,
                }}>
                    <View style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        backgroundColor: isDark ? colors.surface : colors.border,
                        borderRadius: 12,
                        paddingHorizontal: 0,
                        paddingVertical: 6,
                        gap: 4
                    }}>
                        {visibleTabs.map((tab) => (
                            <TouchableOpacity
                                key={tab.key}
                                onPress={() => setActiveTab(tab.key)}
                                style={{
                                    borderRadius: 12,
                                    paddingHorizontal: 8,
                                    paddingVertical: 6,
                                    backgroundColor: activeTab === tab.key ? (isDark ? colors.border : colors.surface) : 'transparent',
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 10,
                                        fontWeight: '600',
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
                    />
                )}
                {activeTab === 'documents' && <ProjectDocuments project={project} user={user} initialFolderId={folderId} />}
                {activeTab === 'photos' && <ProjectPhotos project={project} user={user} initialFolderId={folderId} />}
                {activeTab === 'reports' && user.role !== 'client' && (
                    <View style={{ flex: 1, padding: 14 }}>
                        {/* Toggle */}
                        <View style={{ flexDirection: 'row', backgroundColor: isDark ? colors.surface : '#e2e8f0', borderRadius: 8, padding: 4, marginBottom: 16 }}>
                            <TouchableOpacity
                                onPress={() => setReportType('daily')}
                                style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: reportType === 'daily' ? colors.background : 'transparent', borderRadius: 6 }}
                            >
                                <Text style={{ fontSize: 13, fontWeight: '600', color: reportType === 'daily' ? colors.text : colors.textMuted }}>Daily</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setReportType('weekly')}
                                style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: reportType === 'weekly' ? colors.background : 'transparent', borderRadius: 6 }}
                            >
                                <Text style={{ fontSize: 13, fontWeight: '600', color: reportType === 'weekly' ? colors.text : colors.textMuted }}>Weekly</Text>
                            </TouchableOpacity>
                        </View>
                        {reportType === 'daily' ? (
                            <ProjectDailyReports project={project} userRole={user.role} />
                        ) : (
                            <ProjectWeeklyReports project={project} userRole={user.role} />
                        )}
                    </View>
                )}
                {activeTab === 'snags' && <ProjectSnagList project={project} />}
                {activeTab === 'manuals' && <ProjectManuals project={project} />}
            </View>
        </SafeAreaView>
    );
}
