import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { PrivateAxios } from '@/helpers/PrivateAxios';
import ProjectOverview from '@/components/project/ProjectOverview';
import ProjectDocuments from '@/components/project/ProjectDocuments';
import ProjectPhotos from '@/components/project/ProjectPhotos';
import ProjectDailyReports from '@/components/project/ProjectDailyReports';
import ProjectWeeklyReports from '@/components/project/ProjectWeeklyReports';
import ProjectSnagList from '@/components/project/ProjectSnagList';
import ProjectManuals from '@/components/project/ProjectManuals';

type Tab = 'overview' | 'documents' | 'photos' | 'daily' | 'weekly' | 'snags' | 'manuals';

export default function ProjectWorkspaceScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuth();
    const router = useRouter();

    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const defaultTab: Tab = user?.role === 'client' ? 'documents' : 'overview';
    const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

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
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0d0d0d', justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#f97316" />
        </SafeAreaView>
    );

    if (!project) return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0d0d0d', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff' }}>Project not found</Text>
        </SafeAreaView>
    );

    type TabDef = { key: Tab; label: string; hideForClient?: boolean };
    const tabs: TabDef[] = [
        { key: 'overview', label: 'Overview', hideForClient: true },
        { key: 'documents', label: 'Docs' },
        { key: 'photos', label: 'Photos' },
        { key: 'daily', label: 'Daily', hideForClient: true },
        { key: 'weekly', label: 'Weekly', hideForClient: true },
        { key: 'snags', label: 'Snags' },
        { key: 'manuals', label: 'SOPs' },
    ];

    const visibleTabs = tabs.filter((t) => !(t.hideForClient && user.role === 'client'));

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0d0d0d' }}>
            {/* Header */}
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: '#2a2a2a',
                    backgroundColor: '#111111',
                }}
            >
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 6, borderRadius: 20 }}>
                    <Feather name="arrow-left" size={18} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                        {project.name}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#888' }}>{project.location}</Text>
                </View>
            </View>

            {/* Tab Bar */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ backgroundColor: '#111111', borderBottomWidth: 1, borderBottomColor: '#2a2a2a' }}
                contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 6, gap: 4 }}
            >
                {visibleTabs.map((tab) => (
                    <TouchableOpacity
                        key={tab.key}
                        onPress={() => setActiveTab(tab.key)}
                        style={{
                            borderRadius: 8,
                            paddingHorizontal: 14,
                            paddingVertical: 6,
                            backgroundColor: activeTab === tab.key ? '#1e1e1e' : 'transparent',
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 11,
                                fontWeight: '600',
                                color: activeTab === tab.key ? '#fff' : '#666',
                            }}
                        >
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Tab Content */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
                {activeTab === 'overview' && user.role !== 'client' && (
                    <ProjectOverview project={project} userRole={user.role} />
                )}
                {activeTab === 'documents' && <ProjectDocuments project={project} user={user} />}
                {activeTab === 'photos' && <ProjectPhotos project={project} user={user} />}
                {activeTab === 'daily' && user.role !== 'client' && (
                    <ProjectDailyReports project={project} userRole={user.role} />
                )}
                {activeTab === 'weekly' && user.role !== 'client' && (
                    <ProjectWeeklyReports project={project} userRole={user.role} />
                )}
                {activeTab === 'snags' && <ProjectSnagList project={project} />}
                {activeTab === 'manuals' && <ProjectManuals project={project} />}
            </ScrollView>
        </SafeAreaView>
    );
}
